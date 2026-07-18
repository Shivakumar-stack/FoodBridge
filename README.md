# FoodBridge
**Smart Food Donation & Redistribution Platform**

![Node.js](https://img.shields.io/badge/Node.js-18.x-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)

FoodBridge is a comprehensive full-stack platform designed to bridge the gap between surplus food and those in need. Every day, large amounts of edible food are wasted at restaurants, corporate events, and hotels, while millions remain hungry. FoodBridge solves this logistical challenge by connecting food donors directly with NGOs and volunteers. 

By streamlining the donation process, providing live map tracking, and offering AI-driven food categorization, the platform ensures that surplus food is efficiently and safely redistributed to communities, minimizing waste and maximizing impact.

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| **Authentication & Security** | Secure JWT-based login with session management, rate limiting, and password hashing. |
| **Role-Based Access** | Distinct, tailored dashboard experiences for Donors, NGOs, Volunteers, and Admins. |
| **Food Donation Management** | Donors can list surplus food, while NGOs can claim requests seamlessly. |
| **Interactive Live Maps** | Real-time map tracking for pickups and drop-offs using geospatial data. |
| **Real-time Notifications** | WebSocket integration for instant alerts on donation claims and delivery updates. |
| **AI Food Classification** | Hugging Face Vision API integration to automatically categorize uploaded food images. |
| **Cloud Media Storage** | Secure and scalable image uploads powered by Cloudinary. |
| **Inventory Management** | Tools for NGOs to manage incoming donations and track distributions. |

---

## 🛠️ Technology Stack

**Frontend**
- HTML5 / CSS3
- Vanilla JavaScript
- Tailwind CSS

**Backend**
- Node.js
- Express.js

**Database**
- MongoDB (Atlas)
- Mongoose (ODM)

**Key Libraries & APIs**
- **Security:** `jsonwebtoken`, `bcryptjs`, `helmet`, `cors`
- **Real-time:** `socket.io`
- **Media & AI:** `cloudinary`, `multer`, Hugging Face Inference API
- **Validation:** `zod`, `express-validator`

**Development Tools**
- Jest (Testing)
- ESLint & Prettier
- Nodemon

---

## 📐 System Architecture

```mermaid
flowchart TD
    Donor([Donor]) --> UI
    NGO([NGO]) --> UI
    Volunteer([Volunteer]) --> UI
    UI[Frontend Client (HTML/JS/Tailwind)]
    UI <--> |REST API & WebSockets| API[Express.js API Gateway]
    
    API <--> DB[(MongoDB)]
    API --> Cloudinary[Cloudinary API (Images)]
    API --> HuggingFace[Hugging Face API (AI)]
    API --> Email[SMTP Email Service]
```

---

## 📁 Folder Structure

```text
├── backend/            # Express server, controllers, models, routes, services
├── dataset/            # Synthetic demo data for database seeding
├── docs/               # Documentation assets and scripts
├── frontend/           # UI pages, Tailwind CSS styles, and client scripts
├── scripts/            # Database seeding, maintenance, and migration tools
├── tests/              # Jest testing suite
├── .github/            # CI/CD workflows and actions
├── .env.example        # Environment variable template
└── package.json        # Project dependencies and npm scripts
```

---

## 💻 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Shivakumar-stack/FoodBridge.git
   cd FoodBridge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Copy the example environment file and update it with your credentials:
   ```bash
   cp .env.example .env
   ```

4. **Seed the Database (Optional)**
   Load the platform with demo data for testing:
   ```bash
   npm run seed:demo
   ```

5. **Start the Application**
   Run both frontend and backend concurrently in development mode:
   ```bash
   npm run dev
   ```

---

## ⚙️ Environment Variables

Required variables in `.env`:

| Variable | Description |
|---|---|
| `NODE_ENV` / `PORT` | Environment mode (`development`, `production`) and backend port. |
| `MONGO_URI` | MongoDB connection string (Local or Atlas). |
| `JWT_SECRET` / `JWT_EXPIRE` | Configuration for signing JWT tokens. |
| `SESSION_SECRET` | Secret key for express sessions. |
| `CLIENT_URL` | Frontend client URL for CORS handling. |
| `GEOCODE_*` | (Optional) Configuration for location geocoding. |
| `CLOUDINARY_*` | (Optional) API Keys for Cloudinary image uploads. |
| `HUGGINGFACE_API_KEY` | (Optional) API key for AI food vision. |
| `EMAIL_*` | SMTP credentials for Nodemailer notifications. |
| `GOOGLE_*` / `FACEBOOK_*` / `APPLE_*` | (Optional) OAuth credentials for social authentication. |

---

## 👥 Usage Guide

- **Donor:** Register as a restaurant, hotel, or individual. Use the dashboard to create new donation listings, upload food photos, and track the status of your claims.
- **NGO:** Browse active food donations in your area on the Live Map. Claim donations that match your capacity and track incoming deliveries.
- **Volunteer:** View claimed donations needing transport. Accept pickup tasks and update the logistics status from "In Transit" to "Delivered."
- **Admin:** Monitor overall platform health, manage users, and resolve support tickets.

---

## 📸 Screenshots

*(Screenshots will be hosted externally and updated soon)*

- **[Placeholder] Landing Page Overview**
- **[Placeholder] Interactive Live Map**
- **[Placeholder] NGO Dashboard & Metrics**
- **[Placeholder] Donation Flow**

---

## 🔮 Future Enhancements

- **Mobile App:** Native iOS/Android application for volunteers on the go.
- **Route Optimization:** Smart routing algorithms for volunteers picking up multiple donations.
- **Multi-language Support:** Localization to scale the platform across different regions.
- **QR Code Verification:** Scan-to-verify functionality for secure food handoffs between donors, volunteers, and NGOs.

---

## 📄 License

This project is shared as part of my software development portfolio and for educational purposes.

The source code is not licensed for redistribution, modification, or commercial use without prior permission from the author.

If you would like to use any part of this project, please contact the author first.

---

## ✍️ Author

**Shivakumar-stack**  
Full-Stack Developer  
[GitHub Profile](https://github.com/Shivakumar-stack)
