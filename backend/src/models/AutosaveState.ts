import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAutosaveState extends Document {
  projectID: Types.ObjectId;
  ownerID: Types.ObjectId;
  draftContent: any; // Current draft content
  version: number;
  lastSavedAt: Date;
  saveFrequency: number; // in seconds
  isRecoverable: boolean;
  recoveryToken?: string;
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    deviceType?: string;
    browser?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const autosaveStateSchema = new Schema<IAutosaveState>({
  projectID: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  ownerID: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  draftContent: {
    type: Schema.Types.Mixed,
    required: true
  },
  version: {
    type: Number,
    required: true,
    default: 1
  },
  lastSavedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  saveFrequency: {
    type: Number,
    default: 30, // 30 seconds default
    min: 5, // Minimum 5 seconds
    max: 300 // Maximum 5 minutes
  },
  isRecoverable: {
    type: Boolean,
    default: true
  },
  recoveryToken: {
    type: String,
    unique: true,
    sparse: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceType: String,
    browser: String
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

// Compound index for efficient querying
autosaveStateSchema.index({ projectID: 1, ownerID: 1 });
autosaveStateSchema.index({ lastSavedAt: -1 });
autosaveStateSchema.index({ recoveryToken: 1 });

// Pre-save middleware to generate recovery token if not exists
autosaveStateSchema.pre('save', function(next) {
  if (!this.recoveryToken && this.isRecoverable) {
    this.recoveryToken = require('crypto').randomBytes(32).toString('hex');
  }
  next();
});

// Method to check if autosave is stale (older than 24 hours)
autosaveStateSchema.methods.isStale = function(): boolean {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.lastSavedAt < twentyFourHoursAgo;
};

// Method to get recovery URL (for email notifications, etc.)
autosaveStateSchema.methods.getRecoveryUrl = function(baseUrl: string): string {
  if (!this.recoveryToken) {
    throw new Error('No recovery token available');
  }
  return `${baseUrl}/recover/${this.recoveryToken}`;
};

// Static method to cleanup stale autosave states
autosaveStateSchema.statics.cleanupStaleStates = async function(): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({
    lastSavedAt: { $lt: twentyFourHoursAgo }
  });
  return result.deletedCount;
};

// Static method to find latest autosave state for a project
autosaveStateSchema.statics.findLatestByProject = function(projectID: Types.ObjectId) {
  return this.findOne({ projectID })
    .sort({ lastSavedAt: -1 })
    .populate('projectID')
    .populate('ownerID', 'email');
};

// Static method to find autosave states by owner with pagination
autosaveStateSchema.statics.findByOwner = function(ownerID: Types.ObjectId, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;
  return this.find({ ownerID })
    .sort({ lastSavedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('projectID', 'projectName targetURL')
    .populate('ownerID', 'email');
};

export const AutosaveState = mongoose.model<IAutosaveState>('AutosaveState', autosaveStateSchema);