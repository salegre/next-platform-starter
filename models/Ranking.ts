// Update models/Ranking.ts to include project reference
import mongoose from 'mongoose';

interface PositionHistory {
  position: number;
  date: Date;
}

export interface IRanking extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId; // Add this line
  url: string;
  keyword: string;
  location: string;
  country: string;
  position: number | null;
  title?: string;
  linkUrl?: string;
  createdAt: Date;
  positionHistory: PositionHistory[];
}

const RankingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  project: {  // Add this field
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  url: String,
  keyword: String,
  location: {
    type: String,
    default: 'Global'
  },
  country: {
    type: String,
    default: 'Global'
  },
  position: Number,
  title: String,
  linkUrl: String,
  positionHistory: {
    type: [{
      position: { type: Number, required: true },
      date: { type: Date, default: Date.now }
    }],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const Ranking = mongoose.models.Ranking || mongoose.model<IRanking>('Ranking', RankingSchema);