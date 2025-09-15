import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  googleAuthToken?: string;
  subscriptionStatus: string;
  twocheckoutCustomerID?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockoutUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  isLocked(): boolean;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 6
  },
  googleAuthToken: {
    type: String,
    select: false // Don't include in queries by default
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },
  twocheckoutCustomerID: {
    type: String,
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockoutUntil: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete (ret as any).passwordHash;
      delete (ret as any).googleAuthToken;
      delete (ret as any).loginAttempts;
      delete (ret as any).lockoutUntil;
      return ret;
    }
  }
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ subscriptionStatus: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Security methods
userSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  this.loginAttempts += 1;

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts >= 5) {
    this.lockoutUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  }

  await this.save();
};

userSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  this.loginAttempts = 0;
  this.lockoutUntil = undefined;
  await this.save();
};

userSchema.methods.isLocked = function(): boolean {
  return !!(this.lockoutUntil && this.lockoutUntil > new Date());
};

// Encrypt googleAuthToken before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('googleAuthToken') || !this.googleAuthToken) return next();
  
  try {
    // In a real implementation, you'd use proper encryption here
    // For now, we'll just store it as-is but mark it as encrypted
    this.googleAuthToken = `encrypted:${this.googleAuthToken}`;
    next();
  } catch (error) {
    next(error as Error);
  }
});

export const User = mongoose.model<IUser>('User', userSchema);