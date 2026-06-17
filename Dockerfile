# 1. Use an official Node.js runtime as a parent image
FROM node:18-alpine

# 2. Set the working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json first (for caching efficiency)
COPY package*.json ./

# 4. Install production dependencies
RUN npm install --production

# 5. Copy the rest of your backend application code
COPY . .

# 6. Expose the port your app runs on
EXPOSE 3000

# 7. Define the command to run your app
CMD ["node", "backend/server.js"]