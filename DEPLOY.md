# Deployment Instructions for ProSurvey System

This document outlines how to deploy the ProSurvey System on a Linux server using PM2 and Nginx.

## 1. Prerequisites
- A Linux server (Ubuntu 22.04+ recommended).
- Node.js (v18+) and npm installed.
- MySQL Server installed and running.
- Nginx installed.
- PM2 installed globally: `npm install -g pm2`.

## 2. Database Setup
1. Log in to MySQL: `mysql -u root -p`.
2. Run the provided `schema.sql` script:
   ```sql
   SOURCE /path/to/your/project/schema.sql;
   ```
3. Create a `.env` file in the project root with your MySQL credentials:
   ```env
   DB_HOST=localhost
   DB_USER=your_user
   DB_PASS=your_password
   DB_NAME=prosurvey
   JWT_SECRET=your_random_secret_string
   NODE_ENV=production
   ```

## 3. Backend Configuration (MySQL)
The current `server.ts` uses `better-sqlite3` for the AI Studio preview. To switch to MySQL for production:
1. Open `server.ts`.
2. Replace the `better-sqlite3` import and initialization with `mysql2/promise`.
3. Update the database queries to use MySQL syntax (the provided `schema.sql` is already MySQL compatible).

## 4. Build the Frontend
Run the build command to generate static files:
```bash
npm run build
```
This will create a `dist/` directory.

## 5. Start the Application with PM2
Use PM2 to manage the Node.js process:
```bash
pm2 start tsx --name "prosurvey-app" -- server.ts
```
Or if you compile to JS first:
```bash
pm2 start dist/server.js --name "prosurvey-app"
```

## 6. Nginx Configuration
Create a new Nginx configuration file: `/etc/nginx/sites-available/prosurvey`.
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/prosurvey /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 7. SSL (Optional but Recommended)
Use Certbot to enable HTTPS:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```
