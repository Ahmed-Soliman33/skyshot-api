const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Upload = require('../models/Upload');
const Order = require('../models/Order');
const Mission = require('../models/Mission');
const Page = require('../models/Page');
const Blog = require('../models/Blog');
const Service = require('../models/Service');
const Testimonial = require('../models/Testimonial');
const FAQ = require('../models/FAQ');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const Revenue = require('../models/Revenue');

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skyshot');
    console.log('MongoDB connected for seeding');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Sample data
const sampleUsers = [
  {
    firstName: 'Ahmed',
    lastName: 'Al-Rashid',
    email: 'ahmed@example.com',
    password: 'password123',
    role: 'master',
    status: 'active',
    emailVerified: true,
  },
  {
    firstName: 'Sarah',
    lastName: 'Al-Zahra',
    email: 'sarah@example.com',
    password: 'password123',
    role: 'admin',
    status: 'active',
    emailVerified: true,
  },
  {
    firstName: 'Mohammed',
    lastName: 'Al-Faisal',
    email: 'mohammed@example.com',
    password: 'password123',
    role: 'partner',
    phone: '+966501234567',
    country: 'Saudi Arabia',
    birthDate: new Date('1990-05-15'),
    status: 'active',
    emailVerified: true,
  },
  {
    firstName: 'Fatima',
    lastName: 'Al-Noor',
    email: 'fatima@example.com',
    password: 'password123',
    role: 'user',
    status: 'active',
    emailVerified: true,
  },
  {
    firstName: 'Omar',
    lastName: 'Al-Mansouri',
    email: 'omar@example.com',
    password: 'password123',
    role: 'user',
    status: 'active',
    emailVerified: true,
  },
];

const sampleUploads = [
  {
    title: 'Sunset Over Riyadh Skyline',
    description: 'Beautiful sunset photograph capturing the modern skyline of Riyadh with golden hour lighting.',
    tags: ['sunset', 'riyadh', 'skyline', 'cityscape', 'golden hour'],
    category: 'photography',
    fileType: 'image',
    originalFileUrl: '/uploads/sample/sunset-riyadh.jpg',
    watermarkedFileUrl: '/uploads/sample/sunset-riyadh-watermarked.jpg',
    thumbnailUrl: '/uploads/sample/sunset-riyadh-thumb.jpg',
    previewUrl: '/uploads/sample/sunset-riyadh-preview.jpg',
    fileSize: 2048000,
    dimensions: { width: 1920, height: 1080 },
    price: 50,
    status: 'approved',
    featured: true,
    metadata: {
      camera: 'Canon EOS R5',
      lens: '24-70mm f/2.8',
      settings: 'f/8, 1/125s, ISO 100',
      location: 'Riyadh, Saudi Arabia',
    },
  },
  {
    title: 'Traditional Saudi Architecture',
    description: 'Historic mud-brick architecture in Diriyah showcasing traditional Saudi building techniques.',
    tags: ['architecture', 'traditional', 'diriyah', 'heritage', 'saudi'],
    category: 'photography',
    fileType: 'image',
    originalFileUrl: '/uploads/sample/traditional-architecture.jpg',
    watermarkedFileUrl: '/uploads/sample/traditional-architecture-watermarked.jpg',
    thumbnailUrl: '/uploads/sample/traditional-architecture-thumb.jpg',
    previewUrl: '/uploads/sample/traditional-architecture-preview.jpg',
    fileSize: 1536000,
    dimensions: { width: 1600, height: 1200 },
    price: 75,
    status: 'approved',
    featured: true,
  },
  {
    title: 'Desert Landscape Drone Video',
    description: 'Aerial footage of the stunning Saudi Arabian desert landscape with sand dunes.',
    tags: ['desert', 'drone', 'aerial', 'landscape', 'sand dunes'],
    category: 'video',
    fileType: 'video',
    originalFileUrl: '/uploads/sample/desert-drone.mp4',
    watermarkedFileUrl: '/uploads/sample/desert-drone-watermarked.mp4',
    thumbnailUrl: '/uploads/sample/desert-drone-thumb.jpg',
    previewUrl: '/uploads/sample/desert-drone-preview.mp4',
    fileSize: 52428800,
    dimensions: { width: 3840, height: 2160 },
    duration: 45,
    price: 150,
    status: 'approved',
    featured: true,
  },
];

const samplePages = [
  {
    title: 'About SkyShot',
    slug: 'about',
    content: '<h1>About SkyShot</h1><p>SkyShot is Saudi Arabia\'s premier photography and videography marketplace, connecting talented creators with clients who need professional visual content.</p>',
    excerpt: 'Learn about SkyShot and our mission to connect photographers with clients.',
    status: 'published',
    showInMenu: true,
    menuOrder: 1,
    language: 'en',
  },
  {
    title: 'Contact Us',
    slug: 'contact',
    content: '<h1>Contact Us</h1><p>Get in touch with our team for any questions or support needs.</p>',
    excerpt: 'Contact information and support details.',
    status: 'published',
    showInMenu: true,
    menuOrder: 2,
    language: 'en',
  },
];

const sampleServices = [
  {
    name: 'Wedding Photography',
    slug: 'wedding-photography',
    description: 'Professional wedding photography services capturing your special day with artistic excellence.',
    shortDescription: 'Capture your wedding day with professional photography.',
    category: 'photography',
    type: 'wedding',
    pricing: {
      type: 'package',
      basePrice: 2000,
      packages: [
        {
          name: 'Basic Package',
          description: '4 hours coverage, 100 edited photos',
          price: 2000,
          features: ['4 hours coverage', '100 edited photos', 'Online gallery'],
          duration: 4,
        },
        {
          name: 'Premium Package',
          description: '8 hours coverage, 300 edited photos, engagement session',
          price: 3500,
          features: ['8 hours coverage', '300 edited photos', 'Engagement session', 'Online gallery', 'USB drive'],
          duration: 8,
        },
      ],
    },
    status: 'active',
    featured: true,
  },
];

const sampleTestimonials = [
  {
    name: 'Khalid Al-Otaibi',
    email: 'khalid@example.com',
    company: 'Al-Otaibi Events',
    position: 'Event Manager',
    content: 'SkyShot provided exceptional photography services for our corporate event. The quality was outstanding and the team was very professional.',
    rating: 5,
    serviceType: 'photography',
    projectType: 'event',
    status: 'approved',
    featured: true,
    language: 'en',
  },
  {
    name: 'Nora Al-Saud',
    email: 'nora@example.com',
    content: 'Amazing drone footage for our real estate project. The aerial shots really showcased our property beautifully.',
    rating: 5,
    serviceType: 'drone',
    projectType: 'real_estate',
    status: 'approved',
    featured: true,
    language: 'en',
  },
];

const sampleFAQs = [
  {
    question: 'How do I purchase and download images?',
    answer: 'Simply browse our gallery, select the images you want, add them to your cart, and proceed to checkout. After payment, you\'ll receive download links that are valid for 30 days.',
    category: 'general',
    status: 'active',
    featured: true,
    language: 'en',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept major credit cards, PayPal, and bank transfers. All payments are processed securely through our payment gateway.',
    category: 'payment',
    status: 'active',
    featured: true,
    language: 'en',
  },
  {
    question: 'How can I become a partner photographer?',
    answer: 'To become a partner, register with your portfolio and wait for approval. Once approved, you can apply for missions and upload content for sale.',
    category: 'general',
    status: 'active',
    featured: true,
    language: 'en',
  },
];

// Seeder functions
const seedUsers = async () => {
  console.log('Seeding users...');
  await User.deleteMany({});
  
  for (const userData of sampleUsers) {
    const user = new User(userData);
    await user.save();
  }
  
  console.log(`${sampleUsers.length} users seeded`);
};

const seedUploads = async () => {
  console.log('Seeding uploads...');
  await Upload.deleteMany({});
  
  const users = await User.find({ role: { $in: ['partner', 'user'] } });
  
  for (let i = 0; i < sampleUploads.length; i++) {
    const uploadData = {
      ...sampleUploads[i],
      user: users[i % users.length]._id,
      reviewedBy: (await User.findOne({ role: 'admin' }))._id,
      reviewedAt: new Date(),
    };
    
    const upload = new Upload(uploadData);
    await upload.save();
  }
  
  console.log(`${sampleUploads.length} uploads seeded`);
};

const seedContent = async () => {
  console.log('Seeding content...');
  
  // Seed pages
  await Page.deleteMany({});
  const admin = await User.findOne({ role: 'admin' });
  
  for (const pageData of samplePages) {
    const page = new Page({
      ...pageData,
      author: admin._id,
    });
    await page.save();
  }
  
  // Seed services
  await Service.deleteMany({});
  for (const serviceData of sampleServices) {
    const service = new Service({
      ...serviceData,
      createdBy: admin._id,
    });
    await service.save();
  }
  
  // Seed testimonials
  await Testimonial.deleteMany({});
  for (const testimonialData of sampleTestimonials) {
    const testimonial = new Testimonial({
      ...testimonialData,
      reviewedBy: admin._id,
      reviewedAt: new Date(),
      approvedAt: new Date(),
    });
    await testimonial.save();
  }
  
  // Seed FAQs
  await FAQ.deleteMany({});
  for (const faqData of sampleFAQs) {
    const faq = new FAQ({
      ...faqData,
      createdBy: admin._id,
    });
    await faq.save();
  }
  
  console.log('Content seeded');
};

const seedSettings = async () => {
  console.log('Seeding settings...');
  await Settings.deleteMany({});
  await Settings.initializeDefaults();
  console.log('Settings seeded');
};

// Main seeder function
const seedDatabase = async () => {
  try {
    await connectDB();
    
    console.log('Starting database seeding...');
    
    await seedUsers();
    await seedUploads();
    await seedContent();
    await seedSettings();
    
    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

// Run seeder if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = {
  seedDatabase,
  seedUsers,
  seedUploads,
  seedContent,
  seedSettings,
};
