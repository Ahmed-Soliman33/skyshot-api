const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'mission.title_required'],
      trim: true,
      maxlength: [100, 'mission.title_too_long'],
    },
    description: {
      type: String,
      required: [true, 'mission.description_required'],
      trim: true,
      maxlength: [2000, 'mission.description_too_long'],
    },
    type: {
      type: String,
      enum: {
        values: ['photography', 'videography', 'drone', 'event', 'product', 'portrait', 'landscape'],
        message: 'mission.type_invalid',
      },
      required: [true, 'mission.type_required'],
    },
    location: {
      address: {
        type: String,
        required: [true, 'mission.location_address_required'],
        trim: true,
      },
      city: {
        type: String,
        required: [true, 'mission.location_city_required'],
        trim: true,
      },
      coordinates: {
        latitude: {
          type: Number,
          min: [-90, 'mission.latitude_invalid'],
          max: [90, 'mission.latitude_invalid'],
        },
        longitude: {
          type: Number,
          min: [-180, 'mission.longitude_invalid'],
          max: [180, 'mission.longitude_invalid'],
        },
      },
    },
    scheduledDate: {
      type: Date,
      required: [true, 'mission.scheduled_date_required'],
    },
    duration: {
      type: Number, // Duration in hours
      required: [true, 'mission.duration_required'],
      min: [0.5, 'mission.duration_too_short'],
      max: [24, 'mission.duration_too_long'],
    },
    budget: {
      min: {
        type: Number,
        required: [true, 'mission.budget_min_required'],
        min: [0, 'mission.budget_negative'],
      },
      max: {
        type: Number,
        required: [true, 'mission.budget_max_required'],
        min: [0, 'mission.budget_negative'],
      },
    },
    requirements: [
      {
        type: String,
        trim: true,
        maxlength: [200, 'mission.requirement_too_long'],
      },
    ],
    equipment: [
      {
        type: String,
        trim: true,
        maxlength: [100, 'mission.equipment_too_long'],
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'mission.created_by_required'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['open', 'assigned', 'in_progress', 'completed', 'cancelled', 'rejected'],
        message: 'mission.status_invalid',
      },
      default: 'open',
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: 'mission.priority_invalid',
      },
      default: 'medium',
    },
    applications: [
      {
        partner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        proposedBudget: {
          type: Number,
          required: true,
          min: [0, 'mission.proposed_budget_negative'],
        },
        message: {
          type: String,
          trim: true,
          maxlength: [500, 'mission.application_message_too_long'],
        },
        portfolio: [
          {
            type: String, // URLs to portfolio items
            trim: true,
          },
        ],
        appliedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rejected'],
          default: 'pending',
        },
      },
    ],
    acceptedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'mission.cancellation_reason_too_long'],
    },
    finalBudget: {
      type: Number,
      min: [0, 'mission.final_budget_negative'],
    },
    deliverables: [
      {
        upload: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Upload',
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    feedback: {
      rating: {
        type: Number,
        min: [1, 'mission.rating_too_low'],
        max: [5, 'mission.rating_too_high'],
      },
      comment: {
        type: String,
        trim: true,
        maxlength: [1000, 'mission.feedback_comment_too_long'],
      },
      submittedAt: {
        type: Date,
      },
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [30, 'mission.tag_too_long'],
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for applications count
missionSchema.virtual('applicationsCount').get(function () {
  return this.applications ? this.applications.length : 0;
});

// Virtual for days until scheduled date
missionSchema.virtual('daysUntilScheduled').get(function () {
  if (!this.scheduledDate) return null;
  const now = new Date();
  const scheduled = new Date(this.scheduledDate);
  const diffTime = scheduled - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual for mission duration in readable format
missionSchema.virtual('durationFormatted').get(function () {
  if (!this.duration) return '';
  const hours = Math.floor(this.duration);
  const minutes = Math.round((this.duration - hours) * 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
});

// Indexes for better performance
missionSchema.index({ createdBy: 1, status: 1 });
missionSchema.index({ assignedTo: 1, status: 1 });
missionSchema.index({ status: 1, scheduledDate: 1 });
missionSchema.index({ type: 1, status: 1 });
missionSchema.index({ 'location.city': 1, status: 1 });
missionSchema.index({ tags: 1, status: 1 });
missionSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Pre-save middleware
missionSchema.pre('save', function (next) {
  // Ensure tags are unique and clean
  if (this.tags && this.tags.length > 0) {
    this.tags = [...new Set(this.tags.filter(tag => tag.trim() !== ''))];
  }
  
  // Validate budget range
  if (this.budget && this.budget.min > this.budget.max) {
    return next(new Error('mission.budget_min_greater_than_max'));
  }
  
  // Set timestamps based on status changes
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
      case 'assigned':
        if (!this.acceptedAt) this.acceptedAt = now;
        break;
      case 'in_progress':
        if (!this.startedAt) this.startedAt = now;
        break;
      case 'completed':
        if (!this.completedAt) this.completedAt = now;
        break;
      case 'cancelled':
        if (!this.cancelledAt) this.cancelledAt = now;
        break;
    }
  }
  
  next();
});

// Static method to find open missions
missionSchema.statics.findOpen = function (filters = {}) {
  return this.find({ status: 'open', ...filters })
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

// Static method to find missions by partner
missionSchema.statics.findByPartner = function (partnerId, status = null) {
  const query = { assignedTo: partnerId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('createdBy', 'firstName lastName email')
    .sort({ scheduledDate: 1 });
};

// Instance method to apply for mission
missionSchema.methods.applyForMission = function (partnerId, proposedBudget, message, portfolio = []) {
  // Check if partner already applied
  const existingApplication = this.applications.find(
    app => app.partner.toString() === partnerId.toString()
  );
  
  if (existingApplication) {
    throw new Error('mission.already_applied');
  }
  
  this.applications.push({
    partner: partnerId,
    proposedBudget,
    message,
    portfolio,
  });
  
  return this.save();
};

// Instance method to accept application
missionSchema.methods.acceptApplication = function (partnerId) {
  const application = this.applications.find(
    app => app.partner.toString() === partnerId.toString()
  );
  
  if (!application) {
    throw new Error('mission.application_not_found');
  }
  
  // Update application status
  application.status = 'accepted';
  
  // Reject other applications
  this.applications.forEach(app => {
    if (app.partner.toString() !== partnerId.toString()) {
      app.status = 'rejected';
    }
  });
  
  // Assign mission
  this.assignedTo = partnerId;
  this.status = 'assigned';
  this.finalBudget = application.proposedBudget;
  this.acceptedAt = new Date();
  
  return this.save();
};

// Instance method to complete mission
missionSchema.methods.complete = function (deliverables = []) {
  this.status = 'completed';
  this.completedAt = new Date();
  
  if (deliverables.length > 0) {
    this.deliverables = deliverables.map(uploadId => ({
      upload: uploadId,
      deliveredAt: new Date(),
    }));
  }
  
  return this.save();
};

const Mission = mongoose.model('Mission', missionSchema);

module.exports = Mission;
