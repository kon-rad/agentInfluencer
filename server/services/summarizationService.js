import { Together } from 'together-ai';
import dotenv from 'dotenv';

dotenv.config();

class SummarizationService {
  constructor() {
    this.together = new Together(process.env.TOGETHER_API_KEY);
    this.chunkSize = 2000; // Characters per chunk
    this.overlap = 200;    // Overlap between chunks to maintain context
  }

  splitTextIntoChunks(text) {
    const chunks = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      let endIndex = startIndex + this.chunkSize;
      
      // If not at the end, find a good break point
      if (endIndex < text.length) {
        // Find the last period, question mark, or exclamation point
        const lastSentence = text.substring(endIndex - 100, endIndex).search(/[.!?]\s/);
        if (lastSentence !== -1) {
          endIndex = endIndex - 100 + lastSentence + 1;
        }
      }
      
      chunks.push(text.substring(startIndex, endIndex));
      startIndex = endIndex - this.overlap;
    }
    
    return chunks;
  }

  async summarizeChunk(chunk) {
    try {
      const response = await this.together.chat.completions.create({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [
          {
            role: "system",
            content: "You are a precise summarizer. Create a concise summary of the following text, focusing on the key points and maintaining factual accuracy."
          },
          {
            role: "user",
            content: chunk
          }
        ],
        max_tokens: 500
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error summarizing chunk:', error);
      throw error;
    }
  }

  async summarizeSummaries(summaries) {
    try {
      const combinedSummaries = summaries.join('\n\n');
      
      const response = await this.together.chat.completions.create({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [
          {
            role: "system",
            content: "Create a coherent, comprehensive summary from these partial summaries, eliminating redundancy and maintaining the key points."
          },
          {
            role: "user",
            content: combinedSummaries
          }
        ],
        max_tokens: 1000
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error combining summaries:', error);
      throw error;
    }
  }

  async summarizeText(text) {
    // Split text into manageable chunks
    const chunks = this.splitTextIntoChunks(text);
    
    // Summarize each chunk
    const chunkSummaries = await Promise.all(
      chunks.map(chunk => this.summarizeChunk(chunk))
    );
    
    // If only one chunk, return its summary
    if (chunkSummaries.length === 1) {
      return chunkSummaries[0];
    }
    
    // Combine summaries if multiple chunks
    return await this.summarizeSummaries(chunkSummaries);
  }
}

const summarizationService = new SummarizationService();
export default summarizationService; 