import mongoose from 'mongoose';

// Define the interface for TypeScript
export interface IRanking extends mongoose.Document {
  url: string;
  keyword: string;
  position: number | null;
  title?: string;
  linkUrl?: string;
  createdAt: Date;
}

// Create the Mongoose Schema
const RankingSchema = new mongoose.Schema<IRanking>({
  url: {
    type: String,
    required: true,
    trim: true
  },
  keyword: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: Number,
    default: null
  },
  title: {
    type: String,
    trim: true
  },
  linkUrl: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create and export the model
export const Ranking = mongoose.models.Ranking || mongoose.model<IRanking>('Ranking', RankingSchema);