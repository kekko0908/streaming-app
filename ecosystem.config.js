module.exports = {
  apps: [
    {
      name: "streaming-for-all",
      // Puntiamo direttamente all'eseguibile di Vite
      script: "./node_modules/vite/bin/vite.js",
      // Nessun argomento strano, solo Node
      interpreter: "node",
      watch: false,
      env: {
        NODE_ENV: "development"
      }
    }
  ]
}