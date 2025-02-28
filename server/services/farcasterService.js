import {
  makeCastAdd,
  NobleEd25519Signer,
  FarcasterNetwork,
} from '@farcaster/hub-nodejs';
import dotenv from 'dotenv';

dotenv.config();

class FarcasterService {
  constructor() {
    this.ed25519Signer = new NobleEd25519Signer(process.env.FARCASTER_PRIVATE_KEY);
    this.dataOptions = {
      fid: process.env.FARCASTER_FID,
      network: FarcasterNetwork.MAINNET,
    };
  }

  async postCast(text, mentions = [], mentionsPositions = []) {
    try {
      const cast = await makeCastAdd(
        {
          text,
          embeds: [],
          embedsDeprecated: [],
          mentions,
          mentionsPositions,
        },
        this.dataOptions,
        this.ed25519Signer
      );
      console.log('Cast posted successfully:', cast);
    } catch (error) {
      console.error('Error posting cast:', error);
    }
  }
}

export default new FarcasterService(); 