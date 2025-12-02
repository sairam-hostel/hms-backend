# Use official Node image (choose stable + small footprint)
FROM node:24-alpine

# Set working dir
WORKDIR /app

# Copy package.json + package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy only your source code + config
COPY src/ ./src/
COPY server.js ./
COPY .env ./

# Expose the port your app uses  (or whichever port your Express server listens on via process.env.PORT)
EXPOSE 8000  


# Command to start app
CMD ["node", "server.js"]
