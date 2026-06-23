const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Business Networking & Vendor Directory API",
      version: "1.0.0",
      description:
        "Enterprise-grade API for Business Networking & Vendor Directory Platform. Complete API documentation for all endpoints including Authentication, Vendors, Products, Services, Payments, and more.",
      contact: {
        name: "Least Action Company",
        email: "support@leastaction.in",
        url: "https://leastaction.in",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:5000/api/v1",
        description: "Development server",
      },
      {
        url: "https://api.vendordirectory.com/api/v1",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT Bearer token obtained at login",
        },
      },
      schemas: {
        // ==================== ERROR & SUCCESS ====================
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error message" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
            stack: { type: "string", description: "Stack trace (development only)" },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Operation successful" },
            data: { type: "object" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            currentPage: { type: "integer", example: 1 },
            totalPages: { type: "integer", example: 5 },
            totalItems: { type: "integer", example: 50 },
            itemsPerPage: { type: "integer", example: 10 },
          },
        },

        // ==================== USER ====================
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
            name: { type: "string", example: "John Doe" },
            email: { type: "string", format: "email", example: "john@example.com" },
            phone: { type: "string", example: "+919876543210" },
            role: { type: "string", enum: ["superadmin", "admin", "vendor", "user"], example: "user" },
            avatar: {
              type: "object",
              properties: {
                url: { type: "string", example: "https://res.cloudinary.com/.../avatar.jpg" },
                publicId: { type: "string", example: "avatars/abc123" },
              },
            },
            isActive: { type: "boolean", example: true },
            isEmailVerified: { type: "boolean", example: false },
            isPhoneVerified: { type: "boolean", example: false },
            isSuspended: { type: "boolean", example: false },
            isBlocked: { type: "boolean", example: false },
            referralCode: { type: "string", example: "ABC123" },
            referredBy: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
            preferences: {
              type: "object",
              properties: {
                emailNotifications: { type: "boolean", example: true },
                smsNotifications: { type: "boolean", example: true },
                pushNotifications: { type: "boolean", example: true },
              },
            },
            address: {
              type: "object",
              properties: {
                street: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string", example: "India" },
                pincode: { type: "string" },
              },
            },
            lastLogin: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        UserInput: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "John Doe" },
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", format: "password", minLength: 8, example: "password123" },
            phone: { type: "string", example: "+919876543210" },
            role: { type: "string", enum: ["user", "vendor"], example: "user" },
            referralCode: { type: "string", example: "ABC123" },
          },
        },
        LoginInput: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", format: "password", example: "password123" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Login successful" },
            data: {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/User" },
                accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
                refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
              },
            },
          },
        },

        // ==================== VENDOR ====================
        Vendor: {
          type: "object",
          properties: {
            _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0e" },
            user: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
            businessName: { type: "string", example: "Tech Solutions Pvt Ltd" },
            slug: { type: "string", example: "tech-solutions-pvt-ltd" },
            ownerName: { type: "string", example: "John Doe" },
            email: { type: "string", example: "contact@techsolutions.com" },
            phone: { type: "string", example: "+919876543210" },
            alternatePhone: { type: "string", example: "+919876543211" },
            logo: {
              type: "object",
              properties: {
                url: { type: "string", example: "https://res.cloudinary.com/.../logo.png" },
                publicId: { type: "string", example: "vendors/logo_abc" },
              },
            },
            coverImage: {
              type: "object",
              properties: {
                url: { type: "string" },
                publicId: { type: "string" },
              },
            },
            description: { type: "string", example: "We provide comprehensive IT solutions..." },
            shortDescription: { type: "string", example: "Leading IT solutions provider" },
            businessCategory: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0f" },
            tags: { type: "array", items: { type: "string" }, example: ["technology", "software", "it-services"] },
            gstNumber: { type: "string", example: "27AABCU9603R1ZX" },
            panNumber: { type: "string", example: "ABCDE1234F" },
            address: {
              type: "object",
              properties: {
                street: { type: "string", example: "123, Main Street" },
                city: { type: "string", example: "Mumbai" },
                state: { type: "string", example: "Maharashtra" },
                country: { type: "string", example: "India" },
                pincode: { type: "string", example: "400001" },
              },
              required: ["street", "city", "state", "pincode"],
            },
            location: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["Point"], example: "Point" },
                coordinates: {
                  type: "array",
                  items: { type: "number" },
                  example: [72.8777, 19.076],
                  description: "[longitude, latitude]",
                },
              },
            },
            website: { type: "string", example: "https://techsolutions.com" },
            socialLinks: {
              type: "object",
              properties: {
                facebook: { type: "string" },
                instagram: { type: "string" },
                twitter: { type: "string" },
                linkedin: { type: "string" },
                youtube: { type: "string" },
              },
            },
            status: {
              type: "string",
              enum: ["pending", "approved", "rejected", "suspended"],
              example: "approved",
            },
            isActive: { type: "boolean", example: true },
            isFeatured: { type: "boolean", example: false },
            isVerified: { type: "boolean", example: false },
            membership: {
              type: "object",
              properties: {
                plan: { type: "string", enum: ["free", "silver", "gold", "platinum"], example: "free" },
                startDate: { type: "string", format: "date-time" },
                endDate: { type: "string", format: "date-time" },
                isActive: { type: "boolean", example: false },
              },
            },
            stats: {
              type: "object",
              properties: {
                totalLeads: { type: "integer", example: 25 },
                totalViews: { type: "integer", example: 1000 },
                totalReviews: { type: "integer", example: 10 },
                avgRating: { type: "number", example: 4.5 },
                totalProducts: { type: "integer", example: 5 },
                totalServices: { type: "integer", example: 3 },
              },
            },
            operatingHours: {
              type: "object",
              properties: {
                monday: { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, isOpen: { type: "boolean" } } },
                tuesday: { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, isOpen: { type: "boolean" } } },
                wednesday: { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, isOpen: { type: "boolean" } } },
                thursday: { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, isOpen: { type: "boolean" } } },
                friday: { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, isOpen: { type: "boolean" } } },
                saturday: { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, isOpen: { type: "boolean" } } },
                sunday: { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, isOpen: { type: "boolean" } } },
              },
            },
            documents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string" },
                  publicId: { type: "string" },
                  type: { type: "string", enum: ["gst", "pan", "license", "other"] },
                  uploadedAt: { type: "string", format: "date-time" },
                },
              },
            },
            estYear: { type: "integer", example: 2015 },
            employeeCount: { type: "string", enum: ["1-10", "11-50", "51-200", "201-500", "500+"] },
            annualRevenue: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        VendorInput: {
          type: "object",
          required: ["businessName", "ownerName", "email", "phone", "businessCategory", "address"],
          properties: {
            businessName: { type: "string", example: "Tech Solutions Pvt Ltd" },
            ownerName: { type: "string", example: "John Doe" },
            email: { type: "string", example: "contact@techsolutions.com" },
            phone: { type: "string", example: "+919876543210" },
            alternatePhone: { type: "string", example: "+919876543211" },
            description: { type: "string", example: "We provide comprehensive IT solutions..." },
            shortDescription: { type: "string", example: "Leading IT solutions provider" },
            businessCategory: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0f" },
            tags: { type: "array", items: { type: "string" }, example: ["technology", "software"] },
            gstNumber: { type: "string", example: "27AABCU9603R1ZX" },
            panNumber: { type: "string", example: "ABCDE1234F" },
            address: {
              type: "object",
              required: ["street", "city", "state", "pincode"],
              properties: {
                street: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
                pincode: { type: "string" },
              },
            },
            website: { type: "string" },
            socialLinks: {
              type: "object",
              properties: {
                facebook: { type: "string" },
                instagram: { type: "string" },
                twitter: { type: "string" },
                linkedin: { type: "string" },
                youtube: { type: "string" },
              },
            },
          },
        },

        // ==================== CATEGORY ====================
        Category: {
          type: "object",
          properties: {
            _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0f" },
            name: { type: "string", example: "Technology" },
            slug: { type: "string", example: "technology" },
            type: { type: "string", enum: ["business", "product", "service"], example: "business" },
            description: { type: "string", example: "Technology and IT services" },
            icon: { type: "string", example: "laptop-code" },
            image: {
              type: "object",
              properties: {
                url: { type: "string" },
                publicId: { type: "string" },
              },
            },
            parent: { type: "string", example: null, description: "Parent category ID for subcategories" },
            isActive: { type: "boolean", example: true },
            isFeatured: { type: "boolean", example: false },
            order: { type: "integer", example: 0 },
            subcategories: {
              type: "array",
              items: { $ref: "#/components/schemas/Category" },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CategoryInput: {
          type: "object",
          required: ["name", "type"],
          properties: {
            name: { type: "string", example: "Technology" },
            type: { type: "string", enum: ["business", "product", "service"], example: "business" },
            description: { type: "string", example: "Technology and IT services" },
            icon: { type: "string", example: "laptop-code" },
            parent: { type: "string", example: null },
            isActive: { type: "boolean", example: true },
            isFeatured: { type: "boolean", example: false },
            order: { type: "integer", example: 0 },
            meta: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                keywords: { type: "string" },
              },
            },
          },
        },

        // ==================== PRODUCT ====================
        Product: {
          type: "object",
          properties: {
            _id: { type: "string" },
            vendor: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0e" },
            title: { type: "string", example: "Wireless Bluetooth Headphones" },
            slug: { type: "string", example: "wireless-bluetooth-headphones" },
            description: { type: "string", example: "High-quality wireless headphones with noise cancellation" },
            shortDescription: { type: "string", example: "Premium wireless headphones" },
            category: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0f" },
            sku: { type: "string", example: "TECH-WB-001" },
            barcode: { type: "string" },
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string" },
                  publicId: { type: "string" },
                  isMain: { type: "boolean" },
                },
              },
            },
            pricing: {
              type: "object",
              properties: {
                mrp: { type: "number", example: 2999 },
                sellingPrice: { type: "number", example: 1999 },
                costPrice: { type: "number", example: 1200 },
                currency: { type: "string", example: "INR" },
                taxPercent: { type: "number", example: 18 },
                hsnCode: { type: "string", example: "85183000" },
              },
              required: ["mrp", "sellingPrice"],
            },
            inventory: {
              type: "object",
              properties: {
                quantity: { type: "integer", example: 100 },
                unit: { type: "string", example: "piece" },
                lowStockAlert: { type: "integer", example: 10 },
                isUnlimited: { type: "boolean", example: false },
              },
            },
            attributes: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, value: { type: "string" } },
              },
            },
            variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  price: { type: "number" },
                  stock: { type: "number" },
                  sku: { type: "string" },
                },
              },
            },
            tags: { type: "array", items: { type: "string" }, example: ["electronics", "headphones"] },
            status: { type: "string", enum: ["pending", "approved", "rejected", "draft"], example: "approved" },
            isActive: { type: "boolean", example: true },
            isFeatured: { type: "boolean", example: false },
            stats: {
              type: "object",
              properties: {
                views: { type: "integer", example: 500 },
                orders: { type: "integer", example: 25 },
                avgRating: { type: "number", example: 4.3 },
                totalReviews: { type: "integer", example: 10 },
              },
            },
            shippingInfo: {
              type: "object",
              properties: {
                weight: { type: "number" },
                dimensions: {
                  type: "object",
                  properties: { length: { type: "number" }, width: { type: "number" }, height: { type: "number" } },
                },
                isFreeShipping: { type: "boolean" },
                shippingCharge: { type: "number" },
              },
            },
            warranty: { type: "string" },
            returnPolicy: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ProductInput: {
          type: "object",
          required: ["title", "category", "pricing"],
          properties: {
            title: { type: "string", example: "Wireless Bluetooth Headphones" },
            description: { type: "string", example: "High-quality wireless headphones" },
            shortDescription: { type: "string", example: "Premium wireless headphones" },
            category: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0f" },
            sku: { type: "string", example: "TECH-WB-001" },
            pricing: {
              type: "object",
              required: ["mrp", "sellingPrice"],
              properties: {
                mrp: { type: "number" },
                sellingPrice: { type: "number" },
                costPrice: { type: "number" },
                currency: { type: "string" },
                taxPercent: { type: "number" },
                hsnCode: { type: "string" },
              },
            },
            inventory: {
              type: "object",
              properties: {
                quantity: { type: "integer" },
                unit: { type: "string" },
                lowStockAlert: { type: "integer" },
                isUnlimited: { type: "boolean" },
              },
            },
            tags: { type: "array", items: { type: "string" } },
          },
        },

        // ==================== SERVICE ====================
        Service: {
          type: "object",
          properties: {
            _id: { type: "string" },
            vendor: { type: "string" },
            title: { type: "string", example: "Web Development Services" },
            slug: { type: "string", example: "web-development-services" },
            description: { type: "string", example: "Full-stack web development services using modern technologies" },
            shortDescription: { type: "string", example: "Expert web development team" },
            category: { type: "string" },
            gallery: {
              type: "array",
              items: { type: "object", properties: { url: { type: "string" }, publicId: { type: "string" } } },
            },
            pricing: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["fixed", "hourly", "custom", "range"], example: "fixed" },
                minPrice: { type: "number", example: 50000 },
                maxPrice: { type: "number", example: 200000 },
                currency: { type: "string", example: "INR" },
                unit: { type: "string", example: "project" },
              },
            },
            availability: {
              type: "object",
              properties: {
                days: { type: "array", items: { type: "string" }, example: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
                startTime: { type: "string", example: "09:00" },
                endTime: { type: "string", example: "18:00" },
                isAvailable: { type: "boolean", example: true },
              },
            },
            tags: { type: "array", items: { type: "string" }, example: ["web", "development", "react"] },
            features: { type: "array", items: { type: "string" }, example: ["Responsive Design", "SEO Optimized"] },
            status: { type: "string", enum: ["pending", "approved", "rejected", "draft"], example: "approved" },
            isActive: { type: "boolean", example: true },
            isFeatured: { type: "boolean", example: false },
            deliveryTime: { type: "string", example: "2-4 weeks" },
            serviceArea: { type: "array", items: { type: "string" }, example: ["Mumbai", "India"] },
            faqs: {
              type: "array",
              items: {
                type: "object",
                properties: { question: { type: "string" }, answer: { type: "string" } },
              },
            },
            stats: {
              type: "object",
              properties: {
                views: { type: "integer" },
                inquiries: { type: "integer" },
                avgRating: { type: "number" },
                totalReviews: { type: "integer" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ServiceInput: {
          type: "object",
          required: ["title", "description", "category"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            shortDescription: { type: "string" },
            category: { type: "string" },
            pricing: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["fixed", "hourly", "custom", "range"] },
                minPrice: { type: "number" },
                maxPrice: { type: "number" },
                currency: { type: "string" },
              },
            },
            availability: {
              type: "object",
              properties: {
                days: { type: "array", items: { type: "string" } },
                startTime: { type: "string" },
                endTime: { type: "string" },
              },
            },
            tags: { type: "array", items: { type: "string" } },
            features: { type: "array", items: { type: "string" } },
            deliveryTime: { type: "string" },
            serviceArea: { type: "array", items: { type: "string" } },
          },
        },

        // ==================== LEAD ====================
        Lead: {
          type: "object",
          properties: {
            _id: { type: "string" },
            vendor: { type: "string" },
            submittedBy: { type: "string" },
            assignedTo: { type: "string" },
            name: { type: "string", example: "Jane Smith" },
            email: { type: "string", example: "jane@example.com" },
            phone: { type: "string", example: "+919876543210" },
            company: { type: "string", example: "Acme Corp" },
            subject: { type: "string", example: "Website Development Enquiry" },
            message: { type: "string", example: "We need a new e-commerce website" },
            service: { type: "string" },
            product: { type: "string" },
            budget: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" },
                currency: { type: "string", example: "INR" },
              },
            },
            status: {
              type: "string",
              enum: ["new", "contacted", "qualified", "proposal_sent", "won", "lost"],
              example: "new",
            },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"], example: "medium" },
            source: { type: "string", enum: ["website", "referral", "direct", "social", "other"], example: "website" },
            notes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  addedBy: { type: "string" },
                  addedAt: { type: "string", format: "date-time" },
                  isInternal: { type: "boolean" },
                },
              },
            },
            followUps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  scheduledAt: { type: "string", format: "date-time" },
                  type: { type: "string", enum: ["call", "email", "meeting", "other"] },
                  notes: { type: "string" },
                  isCompleted: { type: "boolean" },
                },
              },
            },
            dealValue: { type: "number" },
            isRead: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        LeadInput: {
          type: "object",
          required: ["vendor", "name", "phone", "subject", "message"],
          properties: {
            vendor: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0e" },
            name: { type: "string", example: "Jane Smith" },
            email: { type: "string", example: "jane@example.com" },
            phone: { type: "string", example: "+919876543210" },
            company: { type: "string", example: "Acme Corp" },
            subject: { type: "string", example: "Website Development Enquiry" },
            message: { type: "string", example: "We need a new e-commerce website" },
            service: { type: "string" },
            product: { type: "string" },
            budget: {
              type: "object",
              properties: { min: { type: "number" }, max: { type: "number" } },
            },
          },
        },

        // ==================== MEMBERSHIP ====================
        MembershipPlan: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string", enum: ["free", "silver", "gold", "platinum"], example: "gold" },
            displayName: { type: "string", example: "Gold Plan" },
            description: { type: "string", example: "Best for growing businesses" },
            price: {
              type: "object",
              properties: {
                monthly: { type: "number", example: 999 },
                yearly: { type: "number", example: 9999 },
              },
            },
            currency: { type: "string", example: "INR" },
            features: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "object" },
                  isHighlighted: { type: "boolean" },
                },
              },
            },
            limits: {
              type: "object",
              properties: {
                products: { type: "integer", example: 50 },
                services: { type: "integer", example: 20 },
                images: { type: "integer", example: 50 },
                leads: { type: "integer", example: 100 },
                featuredListing: { type: "boolean", example: true },
                verifiedBadge: { type: "boolean", example: true },
                prioritySupport: { type: "boolean" },
                analyticsAccess: { type: "boolean" },
                customBranding: { type: "boolean" },
              },
            },
            isActive: { type: "boolean", example: true },
            order: { type: "integer", example: 2 },
            color: { type: "string", example: "#FFD700" },
            badge: { type: "string", example: "⭐" },
          },
        },
        Membership: {
          type: "object",
          properties: {
            _id: { type: "string" },
            vendor: { type: "string" },
            user: { type: "string" },
            plan: { type: "string", enum: ["free", "silver", "gold", "platinum"], example: "gold" },
            billingCycle: { type: "string", enum: ["monthly", "yearly"], example: "monthly" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            isActive: { type: "boolean", example: true },
            isAutoRenew: { type: "boolean", example: false },
            status: { type: "string", enum: ["active", "expired", "cancelled", "pending"], example: "active" },
            payment: { type: "string" },
            price: { type: "number", example: 999 },
            currency: { type: "string", example: "INR" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        MembershipPurchaseInput: {
          type: "object",
          required: ["plan", "billingCycle", "paymentId"],
          properties: {
            plan: { type: "string", enum: ["silver", "gold", "platinum"], example: "gold" },
            billingCycle: { type: "string", enum: ["monthly", "yearly"], example: "monthly" },
            paymentId: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c10" },
          },
        },

        // ==================== PAYMENT ====================
        Payment: {
          type: "object",
          properties: {
            _id: { type: "string" },
            user: { type: "string" },
            vendor: { type: "string" },
            type: { type: "string", enum: ["membership", "featured_listing", "event_registration", "other"] },
            amount: { type: "number", example: 999 },
            currency: { type: "string", example: "INR" },
            gateway: { type: "string", enum: ["razorpay", "stripe", "free"], example: "razorpay" },
            razorpay: {
              type: "object",
              properties: {
                orderId: { type: "string" },
                paymentId: { type: "string" },
                signature: { type: "string" },
                subscriptionId: { type: "string" },
              },
            },
            stripe: {
              type: "object",
              properties: {
                paymentIntentId: { type: "string" },
                sessionId: { type: "string" },
                subscriptionId: { type: "string" },
                customerId: { type: "string" },
              },
            },
            status: {
              type: "string",
              enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
              example: "completed",
            },
            description: { type: "string", example: "Gold Membership - Monthly" },
            invoiceNumber: { type: "string", example: "INV-2024-000001" },
            refund: {
              type: "object",
              properties: {
                amount: { type: "number" },
                reason: { type: "string" },
                refundId: { type: "string" },
                refundedAt: { type: "string", format: "date-time" },
                status: { type: "string", enum: ["pending", "completed", "failed"] },
              },
            },
            taxAmount: { type: "number", example: 180 },
            discountAmount: { type: "number", example: 0 },
            couponCode: { type: "string" },
            receiptUrl: { type: "string" },
            paidAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        RazorpayOrderInput: {
          type: "object",
          required: ["amount", "type"],
          properties: {
            amount: { type: "number", example: 99900, description: "Amount in paise (e.g., 99900 = ₹999)" },
            currency: { type: "string", example: "INR" },
            type: { type: "string", enum: ["membership", "featured_listing", "event_registration", "other"] },
            description: { type: "string", example: "Gold Membership - Monthly" },
          },
        },
        StripePaymentIntentInput: {
          type: "object",
          required: ["amount", "type"],
          properties: {
            amount: { type: "number", example: 99900, description: "Amount in paise" },
            currency: { type: "string", example: "INR" },
            type: { type: "string", enum: ["membership", "featured_listing", "event_registration", "other"] },
            description: { type: "string" },
          },
        },

        // ==================== REVIEW ====================
        Review: {
          type: "object",
          properties: {
            _id: { type: "string" },
            vendor: { type: "string" },
            user: { type: "string" },
            product: { type: "string" },
            service: { type: "string" },
            rating: { type: "integer", minimum: 1, maximum: 5, example: 4 },
            title: { type: "string", example: "Great service!" },
            comment: { type: "string", example: "Excellent quality and timely delivery. Highly recommended!" },
            images: {
              type: "array",
              items: { type: "object", properties: { url: { type: "string" }, publicId: { type: "string" } } },
            },
            status: { type: "string", enum: ["pending", "approved", "rejected", "spam"], example: "approved" },
            isVerifiedPurchase: { type: "boolean", example: false },
            helpfulVotes: {
              type: "array",
              items: { type: "string" },
              description: "Array of user IDs who found this helpful",
            },
            reply: {
              type: "object",
              properties: {
                content: { type: "string" },
                repliedAt: { type: "string", format: "date-time" },
                repliedBy: { type: "string" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ReviewInput: {
          type: "object",
          required: ["vendor", "rating", "comment"],
          properties: {
            vendor: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0e" },
            product: { type: "string" },
            service: { type: "string" },
            rating: { type: "integer", minimum: 1, maximum: 5, example: 4 },
            title: { type: "string", example: "Great service!" },
            comment: { type: "string", example: "Excellent quality and timely delivery." },
          },
        },

        // ==================== EVENT ====================
        Event: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string", example: "Business Networking Summit 2024" },
            slug: { type: "string", example: "business-networking-summit-2024" },
            description: { type: "string", example: "Annual business networking event..." },
            shortDescription: { type: "string", example: "Network with industry leaders" },
            organizer: { type: "string" },
            vendor: { type: "string" },
            category: { type: "string" },
            coverImage: { type: "object", properties: { url: { type: "string" }, publicId: { type: "string" } } },
            type: { type: "string", enum: ["online", "offline", "hybrid"], example: "offline" },
            venue: {
              type: "object",
              properties: {
                name: { type: "string", example: "Grand Hotel" },
                address: { type: "string", example: "123, MG Road" },
                city: { type: "string", example: "Mumbai" },
                state: { type: "string", example: "Maharashtra" },
                mapLink: { type: "string" },
              },
            },
            onlineLink: { type: "string", example: "https://zoom.us/j/..." },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            timezone: { type: "string", example: "Asia/Kolkata" },
            registration: {
              type: "object",
              properties: {
                isRequired: { type: "boolean", example: true },
                isFree: { type: "boolean", example: true },
                price: { type: "number", example: 0 },
                currency: { type: "string", example: "INR" },
                maxAttendees: { type: "integer", example: 500 },
                registrationDeadline: { type: "string", format: "date-time" },
              },
            },
            status: { type: "string", enum: ["draft", "published", "cancelled", "completed"], example: "published" },
            isActive: { type: "boolean", example: true },
            isFeatured: { type: "boolean", example: false },
            tags: { type: "array", items: { type: "string" }, example: ["networking", "business"] },
            stats: {
              type: "object",
              properties: {
                totalRegistrations: { type: "integer" },
                totalAttended: { type: "integer" },
                totalViews: { type: "integer" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        EventInput: {
          type: "object",
          required: ["title", "description", "startDate", "endDate", "type"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            shortDescription: { type: "string" },
            type: { type: "string", enum: ["online", "offline", "hybrid"] },
            venue: {
              type: "object",
              properties: { name: { type: "string" }, address: { type: "string" }, city: { type: "string" }, state: { type: "string" } },
            },
            onlineLink: { type: "string" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            category: { type: "string" },
            registration: {
              type: "object",
              properties: {
                isFree: { type: "boolean" },
                price: { type: "number" },
                maxAttendees: { type: "integer" },
                registrationDeadline: { type: "string", format: "date-time" },
              },
            },
            tags: { type: "array", items: { type: "string" } },
          },
        },

        // ==================== NOTIFICATION ====================
        Notification: {
          type: "object",
          properties: {
            _id: { type: "string" },
            recipient: { type: "string" },
            sender: { type: "string" },
            type: {
              type: "string",
              enum: [
                "lead_new", "lead_update", "review_new", "review_reply",
                "membership_expiry", "membership_activated", "payment_success",
                "payment_failed", "vendor_approved", "vendor_rejected",
                "event_reminder", "event_registration", "referral_reward",
                "product_approved", "service_approved", "support_reply",
                "system", "announcement",
              ],
            },
            title: { type: "string", example: "New Lead Received" },
            message: { type: "string", example: "You have received a new lead from Jane Smith" },
            data: { type: "object" },
            isRead: { type: "boolean", example: false },
            readAt: { type: "string", format: "date-time" },
            link: { type: "string", example: "/leads/abc123" },
            priority: { type: "string", enum: ["low", "normal", "high"], example: "normal" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        NotificationBroadcastInput: {
          type: "object",
          required: ["title", "message", "type"],
          properties: {
            title: { type: "string", example: "System Announcement" },
            message: { type: "string", example: "Platform will be under maintenance tonight" },
            type: { type: "string", enum: ["system", "announcement"], example: "announcement" },
            priority: { type: "string", enum: ["low", "normal", "high"], example: "high" },
            link: { type: "string" },
          },
        },

        // ==================== REFERRAL ====================
        Referral: {
          type: "object",
          properties: {
            _id: { type: "string" },
            referrer: { type: "string" },
            referred: { type: "string" },
            code: { type: "string", example: "ABC123" },
            status: { type: "string", enum: ["pending", "completed", "rewarded", "expired"], example: "completed" },
            reward: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["cash", "discount", "credits", "none"] },
                amount: { type: "number" },
                currency: { type: "string", example: "INR" },
                isGiven: { type: "boolean" },
              },
            },
            completedAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ==================== SUPPORT TICKET ====================
        SupportTicket: {
          type: "object",
          properties: {
            _id: { type: "string" },
            ticketNumber: { type: "string", example: "TKT-000001" },
            user: { type: "string" },
            assignedTo: { type: "string" },
            subject: { type: "string", example: "Unable to upload product images" },
            description: { type: "string", example: "I keep getting an error when uploading images..." },
            category: { type: "string", enum: ["billing", "technical", "account", "vendor", "general", "other"], example: "technical" },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"], example: "medium" },
            status: { type: "string", enum: ["open", "in_progress", "waiting_for_user", "resolved", "closed"], example: "open" },
            attachments: {
              type: "array",
              items: { type: "object", properties: { url: { type: "string" }, publicId: { type: "string" }, name: { type: "string" } } },
            },
            replies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sender: { type: "string" },
                  message: { type: "string" },
                  attachments: { type: "array", items: { type: "object" } },
                  isInternal: { type: "boolean" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            slaDeadline: { type: "string", format: "date-time" },
            firstResponseAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        SupportTicketInput: {
          type: "object",
          required: ["subject", "description"],
          properties: {
            subject: { type: "string", example: "Unable to upload product images" },
            description: { type: "string", example: "I keep getting an error when uploading images..." },
            category: { type: "string", enum: ["billing", "technical", "account", "vendor", "general", "other"], example: "technical" },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"], example: "medium" },
          },
        },

        // ==================== AUDIT LOG ====================
        AuditLog: {
          type: "object",
          properties: {
            _id: { type: "string" },
            user: { type: "string" },
            action: { type: "string", example: "UPDATE" },
            resource: { type: "string", example: "Vendor" },
            resourceId: { type: "string" },
            details: { type: "object" },
            ipAddress: { type: "string", example: "192.168.1.1" },
            userAgent: { type: "string" },
            method: { type: "string", example: "PATCH" },
            endpoint: { type: "string", example: "/api/v1/vendors/abc123" },
            statusCode: { type: "integer", example: 200 },
            duration: { type: "integer", example: 150 },
            isSuccess: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ==================== DASHBOARD STATS ====================
        DashboardStats: {
          type: "object",
          properties: {
            totalUsers: { type: "integer", example: 1500 },
            totalVendors: { type: "integer", example: 350 },
            totalProducts: { type: "integer", example: 1200 },
            totalServices: { type: "integer", example: 800 },
            totalLeads: { type: "integer", example: 500 },
            totalRevenue: { type: "number", example: 2500000 },
            activeMemberships: { type: "integer", example: 200 },
            pendingApprovals: { type: "integer", example: 15 },
            totalEvents: { type: "integer", example: 45 },
            totalReviews: { type: "integer", example: 300 },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Authentication", description: "Authentication endpoints (register, login, logout, verify email, password management)" },
      { name: "Users", description: "User profile and account management" },
      { name: "Vendors", description: "Vendor/Business profile management" },
      { name: "Categories", description: "Business, product, and service categories" },
      { name: "Products", description: "Product listing and inventory management" },
      { name: "Services", description: "Service listing and management" },
      { name: "Leads", description: "Lead/enquiry management for vendors" },
      { name: "Memberships", description: "Membership plans and subscriptions" },
      { name: "Payments", description: "Payment processing (Razorpay, Stripe, refunds)" },
      { name: "Reviews", description: "Vendor/product/service reviews and ratings" },
      { name: "Events", description: "Event management and registration" },
      { name: "Referrals", description: "Referral program management" },
      { name: "Notifications", description: "User notifications and broadcast" },
      { name: "Reports", description: "Admin analytics and reporting" },
      { name: "Support", description: "Support ticket system" },
      { name: "Directory", description: "Public directory search and discovery" },
      { name: "Admin", description: "Admin panel operations (requires admin role)" },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;