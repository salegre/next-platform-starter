import mongoose from 'mongoose';

interface PositionHistory {
  position: number;
  date: Date;
  type?: string;
  landingPage?: string;
}

export interface IRanking extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  url: string;
  keyword: string;
  location: string;
  country: string;
  position: number | null;
  title?: string;
  linkUrl?: string;
  positionHistory: PositionHistory[];
  searchVolume: number;
  cpc: number;
  keywordDifficulty: number;
  createdAt: Date;
  updatedAt: Date;
}

const RankingSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    url: String,
    keyword: {
      type: String,
      required: true
    },
    location: {
      type: String,
      default: 'Global'
    },
    country: {
      type: String,
      default: 'Global'
    },
    position: {
      type: Number,
      default: null
    },
    title: String,
    linkUrl: String,
    positionHistory: [{
      position: { 
        type: Number, 
        required: true 
      },
      date: { 
        type: Date, 
        required: true 
      },
      type: String,
      landingPage: String
    }],
    searchVolume: {
      type: Number,
      default: 0
    },
    cpc: {
      type: Number,
      default: 0
    },
    keywordDifficulty: {
      type: Number,
      default: 0
    }
}, {
    timestamps: true
});

// Add index for faster queries
RankingSchema.index({ user: 1, keyword: 1 });

export const Ranking = mongoose.models.Ranking || mongoose.model<IRanking>('Ranking', RankingSchema);