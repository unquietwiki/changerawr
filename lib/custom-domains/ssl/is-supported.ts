// Only true when running inside the Docker deployment.
// DOCKER_DEPLOYMENT=true is set by docker-compose.yml and never by npm start.
export const sslSupported = process.env.DOCKER_DEPLOYMENT === 'true'