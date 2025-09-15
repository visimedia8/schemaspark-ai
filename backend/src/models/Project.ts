import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISchemaDraft {
  content: any; // JSON-LD schema draft
  version: number;
  createdAt: Date;
  updatedAt: Date;
  author?: string; // User who created this version
  changes?: string[]; // List of changes made
  tags?: string[]; // Version tags (e.g., 'major', 'minor', 'auto')
  size?: number; // Content size in bytes
  checksum?: string; // Content hash for integrity
}

export interface IProject extends Document {
  projectID: string;
  ownerID: Types.ObjectId;
  projectName: string;
  targetURL: string;
  targetKeywords?: string[];
  finalSchemaOutput?: any; // JSON-LD schema
  status: 'draft' | 'processing' | 'complete' | 'error' | 'autosave';
  currentDraft?: ISchemaDraft;
  draftHistory: ISchemaDraft[];
  autosaveEnabled: boolean;
  lastAutosaveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
  processingStartTime?: Date;
  processingEndTime?: Date;
}

const schemaDraftSchema = new Schema<ISchemaDraft>({
  content: {
    type: Schema.Types.Mixed,
    required: true
  },
  version: {
    type: Number,
    required: true,
    default: 1
  },
  author: {
    type: String,
    trim: true
  },
  changes: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  size: {
    type: Number,
    default: 0
  },
  checksum: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const projectSchema = new Schema<IProject>({
  projectID: {
    type: String,
    required: true,
    unique: true,
    default: () => new Types.ObjectId().toString()
  },
  ownerID: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  targetURL: {
    type: String,
    required: true,
    trim: true,
    match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Please provide a valid URL']
  },
  targetKeywords: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  finalSchemaOutput: {
    type: Schema.Types.Mixed // JSON-LD schema
  },
  status: {
    type: String,
    enum: ['draft', 'processing', 'complete', 'error', 'autosave'],
    default: 'draft'
  },
  currentDraft: schemaDraftSchema,
  draftHistory: [schemaDraftSchema],
  autosaveEnabled: {
    type: Boolean,
    default: true
  },
  lastAutosaveAt: Date,
  errorMessage: {
    type: String,
    trim: true
  },
  processingStartTime: Date,
  processingEndTime: Date
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

// Indexes for better query performance
projectSchema.index({ ownerID: 1, createdAt: -1 });
projectSchema.index({ projectID: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ targetURL: 1 });
projectSchema.index({ 'currentDraft.updatedAt': -1 });

// Method to add a new draft version
projectSchema.methods.addDraftVersion = function(content: any, options?: {
  author?: string;
  changes?: string[];
  tags?: string[];
}): ISchemaDraft {
  const newVersion = this.draftHistory.length > 0
    ? Math.max(...this.draftHistory.map((d: any) => d.version)) + 1
    : 1;

  const contentString = JSON.stringify(content);
  const checksum = require('crypto').createHash('md5').update(contentString).digest('hex');

  const newDraft: ISchemaDraft = {
    content,
    version: newVersion,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: options?.author,
    changes: options?.changes || [],
    tags: options?.tags || ['auto'],
    size: Buffer.byteLength(contentString, 'utf8'),
    checksum
  };

  this.currentDraft = newDraft;
  this.draftHistory.push(newDraft);
  this.status = this.status === 'complete' ? 'draft' : this.status;
  this.lastAutosaveAt = new Date();

  return newDraft;
};

// Method to restore a specific draft version
projectSchema.methods.restoreDraftVersion = function(version: number): boolean {
  const draftToRestore = this.draftHistory.find((d: any) => d.version === version);
  if (!draftToRestore) return false;

  this.currentDraft = { ...draftToRestore.toObject() };
  this.currentDraft.updatedAt = new Date();
  this.status = 'draft';
  
  return true;
};

// Method to get draft history with limited entries
projectSchema.methods.getDraftHistory = function(limit: number = 10): ISchemaDraft[] {
  return this.draftHistory
    .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
};

// Method to compare two versions
projectSchema.methods.compareVersions = function(version1: number, version2: number): any {
  const draft1 = this.draftHistory.find((d: any) => d.version === version1);
  const draft2 = this.draftHistory.find((d: any) => d.version === version2);

  if (!draft1 || !draft2) {
    return null;
  }

  const changes = {
    added: [] as string[],
    removed: [] as string[],
    modified: [] as string[]
  };

  // Simple comparison - in a real implementation, you'd use a proper diff library
  const content1 = JSON.stringify(draft1.content, null, 2);
  const content2 = JSON.stringify(draft2.content, null, 2);

  if (content1 !== content2) {
    changes.modified.push('Content has been modified');
  }

  return {
    version1: draft1.version,
    version2: draft2.version,
    changes,
    sizeDifference: draft2.size - draft1.size
  };
};

// Method to tag a version
projectSchema.methods.tagVersion = function(version: number, tags: string[]): boolean {
  const draft = this.draftHistory.find((d: any) => d.version === version);
  if (!draft) return false;

  draft.tags = [...new Set([...(draft.tags || []), ...tags])];
  return true;
};

// Method to search versions by tags or content
projectSchema.methods.searchVersions = function(query: {
  tags?: string[];
  author?: string;
  dateFrom?: Date;
  dateTo?: Date;
  content?: string;
}): ISchemaDraft[] {
  return this.draftHistory.filter((draft: any) => {
    if (query.tags && query.tags.length > 0) {
      const hasTag = query.tags.some(tag =>
        draft.tags && draft.tags.includes(tag.toLowerCase())
      );
      if (!hasTag) return false;
    }

    if (query.author && draft.author !== query.author) {
      return false;
    }

    if (query.dateFrom && draft.createdAt < query.dateFrom) {
      return false;
    }

    if (query.dateTo && draft.createdAt > query.dateTo) {
      return false;
    }

    if (query.content) {
      const contentString = JSON.stringify(draft.content).toLowerCase();
      if (!contentString.includes(query.content.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
};

// Method to get version statistics
projectSchema.methods.getVersionStats = function(): any {
  const totalVersions = this.draftHistory.length;
  const autoVersions = this.draftHistory.filter((d: any) => d.tags?.includes('auto')).length;
  const manualVersions = totalVersions - autoVersions;

  const authors = [...new Set(this.draftHistory.map((d: any) => d.author).filter(Boolean))];
  const tags = [...new Set(this.draftHistory.flatMap((d: any) => d.tags || []))];

  const avgSize = totalVersions > 0
    ? this.draftHistory.reduce((sum: number, d: any) => sum + (d.size || 0), 0) / totalVersions
    : 0;

  return {
    totalVersions,
    autoVersions,
    manualVersions,
    uniqueAuthors: authors.length,
    authors,
    uniqueTags: tags.length,
    tags,
    averageSize: Math.round(avgSize),
    oldestVersion: totalVersions > 0 ? this.draftHistory[totalVersions - 1]?.createdAt : null,
    newestVersion: totalVersions > 0 ? this.draftHistory[0]?.createdAt : null
  };
};

// Method to export version history
projectSchema.methods.exportVersions = function(options?: {
  format?: 'json' | 'csv';
  versions?: number[];
  includeContent?: boolean;
}): any {
  let versions = this.draftHistory;

  if (options?.versions) {
    versions = this.draftHistory.filter((d: any) => options.versions!.includes(d.version));
  }

  if (options?.format === 'csv') {
    const csvData = versions.map((draft: any) => ({
      version: draft.version,
      createdAt: draft.createdAt.toISOString(),
      author: draft.author || '',
      tags: (draft.tags || []).join(';'),
      size: draft.size || 0,
      content: options?.includeContent ? JSON.stringify(draft.content) : ''
    }));
    return csvData;
  }

  return versions.map((draft: any) => ({
    ...draft.toObject(),
    content: options?.includeContent !== false ? draft.content : undefined
  }));
};

// Static method to find projects by owner with pagination
projectSchema.statics.findByOwner = function(ownerID: string, page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;
  return this.find({ ownerID })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('ownerID', 'email');
};

// Pre-save middleware to validate draft history size
projectSchema.pre('save', function(next) {
  // Keep only the last 50 draft versions to prevent bloating
  if (this.draftHistory.length > 50) {
    this.draftHistory = this.draftHistory
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50);
  }
  next();
});

export const Project = mongoose.model<IProject>('Project', projectSchema);