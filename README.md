# Willow — A Digital Log for Everyday

Willow is a personal, daily-use web application that combines productivity with creativity. It lets users manage tasks in a light, gamified way while also offering a space to capture moments from their day through a digital scrapbook-style log. Rather than focusing strictly on productivity or mindfulness, Willow aims to create a positive and enjoyable experience that users are motivated to return to daily.

---

##  Tech Stack

| Layer | Technology |
|---|---|
| Backend Environment | Node.js |
| Backend Framework | Express.js |
| Database | PostgreSQL |
| Password Security | `bcrypt` |
| Session Management | `express-session` |
| File Uploads | `multer` |
| DB Client | `pg` |
| Config | `dotenv` |

---

## Setup & Installation

### Prerequisites
- **Node.js** v18+
- **PostgreSQL** installed and running locally

### 1. Clone the Repository
```bash
git clone https://github.com/cybermeen/willow-digital-scrapbook
cd willow-digital-scrapbook
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment Variables
Create a `.env` file inside the `backend` directory:
```env
PORT=3000
SESSION_SECRET=your_super_secret_session_key
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password
UPLOAD_PATH=./uploads
```

### 4. Set Up the Database
1. Open your PostgreSQL client (e.g., `psql`, pgAdmin) and create a database matching your `DB_NAME`:
   ```sql
   CREATE DATABASE willow_db;
   ```
2. Run the schema file to generate all required tables:
   ```bash
   psql -U your_postgres_username -d your_db_name -f backend/db/schema.sql
   ```
3. Seed the database with default prompts and art assets:
   ```bash
   node seed.js
   ```

### 5. Run the server
```bash
npm start
```

The server will start on the configured port. You should see:
```
Server running on port 5000
Connected to PostgreSQL successfully!
```
### 6. Run the frontend
```bash
cd frontend
npm install
npm start
```
---
