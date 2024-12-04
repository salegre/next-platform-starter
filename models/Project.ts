import mongoose from 'mongoose';

export interface IAuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  url?: string;
  timestamp: Date;
}

export interface ISiteStructure {
  totalPages: number;
  maxDepth: number;
  internalLinks: number;
  externalLinks: number;
}

export interface IPageLink {
  url: string;
  text: string;
  type: 'internal' | 'external';
}

export interface IPage {
  url: string;
  title: string;
  links: IPageLink[];
  level: number;
  parentUrl?: string;
  status?: number;
  error?: string;
}

export interface IProject extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  name: string;
  domain: string;
  description?: string;
  createdAt: Date;
  lastAuditDate?: Date;
  auditResults?: IAuditResult[];
  siteStructure?: ISiteStructure;
  pages?: IPage[];
}

const ProjectSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot be longer than 100 characters']
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be longer than 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastAuditDate: Date,
  auditResults: [{
    type: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      required: true,
      enum: ['error', 'warning', 'info']
    },
    message: {
      type: String,
      required: true
    },
    details: String,
    url: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  siteStructure: {
    totalPages: Number,
    maxDepth: Number,
    internalLinks: Number,
    externalLinks: Number
  },
  pages: [{
    url: String,
    title: String,
    links: [{
      url: String,
      text: String,
      type: {
        type: String,
        enum: ['internal', 'external']
      }
    }],
    level: Number,
    parentUrl: String,
    status: Number,
    error: String
  }]
});

// Clean the data before saving
ProjectSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.normalize('NFC').trim();
  }
  if (this.isModified('domain')) {
    this.domain = this.domain.normalize('NFC').toLowerCase().trim();
  }
  if (this.isModified('description') && this.description) {
    this.description = this.description.normalize('NFC').trim();
  }
  next();
});

export const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);