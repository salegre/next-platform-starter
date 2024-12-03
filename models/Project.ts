// models/Project.ts
import mongoose from 'mongoose';

export interface IAuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  location?: string;
  timestamp: Date;
}

export interface IProject extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  name: string;
  domain: string;
  description?: string;
  createdAt: Date;
  lastAuditDate?: Date;
  auditResults?: IAuditResult[];
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
    maxlength: [100, 'Project name cannot be longer than 100 characters'],
    validate: {
      validator: function(v: string) {
        return /^[\x20-\x7E]+$/.test(v); // Only allow printable ASCII characters
      },
      message: 'Project name contains invalid characters'
    }
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v: string) {
        return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(v);
      },
      message: 'Please enter a valid domain name'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be longer than 500 characters'],
    validate: {
      validator: function(v: string) {
        return !v || /^[\x20-\x7E]+$/.test(v); // Only allow printable ASCII characters if value exists
      },
      message: 'Description contains invalid characters'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastAuditDate: Date,
  auditResults: [{
    type: {
      type: String,
      required: true,
      enum: ['meta', 'performance', 'security', 'content']
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
    location: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
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