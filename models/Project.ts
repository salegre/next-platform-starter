import mongoose from 'mongoose';

export interface IAuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  url?: string;
  timestamp?: Date;
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
  auditResults?: IAuditResult[];
}

export interface ISiteStructure {
  totalPages: number;
  maxDepth: number;
  internalLinks: number;
  externalLinks: number;
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

const AuditResultSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['meta', 'content', 'error']
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
  details: {
    type: String,
    required: false
  },
  url: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: false
  }
}, { 
  _id: false,
  strict: true 
});

const PageLinkSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['internal', 'external']
  }
}, { 
  _id: false,
  strict: true 
});

const PageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: false
  },
  links: {
    type: [PageLinkSchema],
    default: []
  },
  level: {
    type: Number,
    required: true
  },
  parentUrl: {
    type: String,
    required: false
  },
  status: {
    type: Number,
    required: false
  },
  error: {
    type: String,
    required: false
  },
  auditResults: {
    type: [AuditResultSchema],
    default: []
  }
}, { 
  _id: false,
  strict: true 
});

const SiteStructureSchema = new mongoose.Schema({
  totalPages: {
    type: Number,
    required: true,
    default: 0
  },
  maxDepth: {
    type: Number,
    required: true,
    default: 0
  },
  internalLinks: {
    type: Number,
    required: true,
    default: 0
  },
  externalLinks: {
    type: Number,
    required: true,
    default: 0
  }
}, { 
  _id: false,
  strict: true 
});

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
  lastAuditDate: {
    type: Date,
    required: false
  },
  auditResults: {
    type: [AuditResultSchema],
    default: []
  },
  siteStructure: {
    type: SiteStructureSchema,
    required: false
  },
  pages: {
    type: [PageSchema],
    default: []
  }
}, {
  strict: true
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