import { fal } from "@fal-ai/client";
import db from '../database.js';
import logger from '../utils/logger.js';
import AWS from 'aws-sdk';
import { Together } from 'together-ai';
import dotenv from 'dotenv';

dotenv.config();

// Configure fal.ai client
fal.config({
  credentials: process.env.FAL_KEY
});

// Configure Together AI
const together = new Together(process.env.TOGETHER_API_KEY);

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

class VideoGenerationService {
  async generateScript(prompt) {
    try {
      logger.info('Generating script from prompt:', prompt);
      
      const response = await together.chat.completions.create({
        model: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
        messages: [
          {
            role: "system",
            content: "You are a professional video script writer. Create an engaging and informative script for a short-form video that will be split into 7 scenes. The script should be concise, engaging, and suitable for visual storytelling."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        top_p: 0.7,
        repetition_penalty: 1
      });

      const script = response.choices[0].message.content;
      logger.info('Generated script:', script);
      return script;
    } catch (error) {
      logger.error('Error generating script:', error);
      throw error;
    }
  }

  async generateScenePrompts(script) {
    try {
      logger.info('Generating scene prompts from script');
      
      const response = await together.chat.completions.create({
        model: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
        messages: [
          {
            role: "system",
            content: "You are a video scene planner. Given a script, break it down into 7 distinct visual scenes. For each scene, create a detailed prompt that describes what should be shown visually. Each prompt should be specific and vivid, suitable for AI video generation."
          },
          {
            role: "user",
            content: `Please break down this script into 7 visual scene prompts:\n\n${script}`
          }
        ],
        temperature: 0.7,
        top_p: 0.7,
        repetition_penalty: 1
      });

      const scenePromptsText = response.choices[0].message.content;
      
      // Parse the response into an array of scene prompts
      // Assuming the model returns numbered scenes like "1. Scene description"
      const scenes = scenePromptsText
        .split(/\d+\.\s+/)
        .filter(scene => scene.trim())
        .map((scene, index) => `Scene ${index + 1}: ${scene.trim()}`);

      logger.info('Generated scene prompts:', scenes);
      return scenes;
    } catch (error) {
      logger.error('Error generating scene prompts:', error);
      throw error;
    }
  }

  async generateVideo(prompt, aspectRatio = "16:9", duration = "5s") {
    try {
      logger.info('Starting video generation for prompt:', prompt);
      const result = await fal.subscribe("fal-ai/veo2", {
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          duration: duration
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(logger.info);
          }
        },
      });

      logger.info('Video generation completed, URL:', result.data.video.url);
      return result.data.video.url;
    } catch (error) {
      logger.error('Error generating video:', error);
      throw error;
    }
  }

  async uploadToS3(videoUrl, fileName) {
    try {
      logger.info('Starting S3 upload for video:', fileName);
      // Download the video from the fal.ai URL
      const response = await fetch(videoUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to S3
      const uploadResult = await s3.upload({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: `videos/${fileName}`,
        Body: buffer,
        ContentType: 'video/mp4'
      }).promise();

      logger.info('S3 upload completed, URL:', uploadResult.Location);
      return uploadResult.Location;
    } catch (error) {
      logger.error('Error uploading to S3:', error);
      throw error;
    }
  }

  async updateVideoProgress(videoId, progress, error = null) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE agent_videos SET progress = ?, error = ? WHERE id = ?',
        [progress, error, videoId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async createSceneRecord(videoId, sceneNumber, prompt) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO video_scenes (video_id, scene_number, prompt) VALUES (?, ?, ?)',
        [videoId, sceneNumber, prompt],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async updateSceneStatus(sceneId, status, videoUrl = null, error = null) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE video_scenes SET status = ?, video_url = ?, error = ?, completed_at = CASE WHEN ? = "completed" THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?',
        [status, videoUrl, error, status, sceneId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async createVideo(agentId, prompt) {
    let videoRecord;
    try {
      logger.info('=== Starting Video Generation Process ===');
      logger.info('Agent ID:', agentId);
      logger.info('Initial Prompt:', prompt);

      // Generate script
      const script = await this.generateScript(prompt);
      logger.info('Generated Script:', script);

      // Generate scene prompts
      const scenePrompts = await this.generateScenePrompts(script);
      logger.info('Generated Scene Prompts:', scenePrompts);

      // Save initial record to database
      videoRecord = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO agent_videos (agent_id, script, scene_prompts, status, progress) VALUES (?, ?, ?, ?, ?)',
          [agentId, script, JSON.stringify(scenePrompts), 'processing', 0],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      logger.info('Created video record with ID:', videoRecord);

      // Generate videos for each scene
      const videoUrls = [];
      let completedScenes = 0;
      
      for (let i = 0; i < scenePrompts.length; i++) {
        const scenePrompt = scenePrompts[i];
        const sceneNumber = i + 1;
        
        try {
          logger.info(`Processing scene ${sceneNumber}/${scenePrompts.length}`);
          
          // Create scene record
          const sceneId = await this.createSceneRecord(videoRecord, sceneNumber, scenePrompt);
          
          // Generate video for scene
          const videoUrl = await this.generateVideo(scenePrompt);
          videoUrls.push(videoUrl);
          
          // Update scene status
          await this.updateSceneStatus(sceneId, 'completed', videoUrl);
          
          // Update progress
          completedScenes++;
          const progress = Math.round((completedScenes / scenePrompts.length) * 100);
          await this.updateVideoProgress(videoRecord, progress);
          
          logger.info(`Scene ${sceneNumber} completed. Progress: ${progress}%`);
        } catch (error) {
          logger.error(`Error processing scene ${sceneNumber}:`, error);
          if (typeof sceneId !== 'undefined') {
            await this.updateSceneStatus(sceneId, 'error', null, error.message);
          }
          throw error;
        }
      }

      // TODO: Implement video merging logic here
      // For now, we'll just use the first video
      const finalVideoUrl = videoUrls[0];

      // Upload to S3
      const s3Url = await this.uploadToS3(finalVideoUrl, `agent_${agentId}_video_${videoRecord}.mp4`);

      // Update database record
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE agent_videos SET video_url = ?, status = ?, completed_at = ?, progress = ? WHERE id = ?',
          [s3Url, 'completed', new Date().toISOString(), 100, videoRecord],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      logger.info('=== Video Generation Complete ===');
      logger.info('Final video URL:', s3Url);
      logger.info('===============================');

      return {
        videoId: videoRecord,
        videoUrl: s3Url
      };
    } catch (error) {
      logger.error('Error in video generation process:', error);
      
      // Update video record with error if it exists
      if (videoRecord) {
        await this.updateVideoProgress(videoRecord, null, error.message);
      }
      
      throw error;
    }
  }
}

export default new VideoGenerationService(); 