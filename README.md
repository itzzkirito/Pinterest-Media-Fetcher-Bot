# Pinterest Discord Bot

A professional Discord bot that automatically fetches and uploads profile pictures (PFPs), banners, and GIFs from Pinterest API to Discord channels. Built with Node.js, TypeScript, Discord.js, and Pinterest API integration.

## Features

- 🔍 **Smart Media Search**: Search Pinterest for specific types of media (PFPs, banners, GIFs)
- 📥 **Automatic Downloads**: Automatically downloads and processes media from Pinterest
- 🚀 **Discord Integration**: Seamlessly uploads media to Discord channels with rich embeds
- ⚡ **Async Event Handling**: Efficient asynchronous processing for optimal performance
- 🎯 **Command System**: Easy-to-use slash-style commands for fetching media
- 🔒 **Type-Safe**: Built with TypeScript for type safety and better developer experience
- 🛡️ **Rate Limit Protection**: Built-in rate limiting for both Discord and Pinterest API
- 💾 **Database Caching**: Prisma-powered caching to reduce API calls and improve performance
- 📊 **Usage Tracking**: Logs all command usage for analytics and debugging

## Tech Stack

- **Node.js** - Runtime environment
- **TypeScript** - Type-safe JavaScript
- **Discord.js** - Discord API wrapper
- **Prisma** - Database ORM with SQLite
- **Axios** - HTTP client for API requests
- **Pinterest API** - Media source
- **p-queue** - Queue management for rate limiting

## Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Discord Bot Token
- Pinterest API Access Token
- SQLite (included with Node.js)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pinterest-discord-bot.git
   cd pinterest-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your credentials:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   DISCORD_CLIENT_ID=your_discord_client_id_here
   PINTEREST_ACCESS_TOKEN=your_pinterest_access_token_here
   PREFIX=!
   DATABASE_URL=file:./data.db
   RATE_LIMIT_MAX_REQUESTS=10
   RATE_LIMIT_WINDOW_MS=60000
   ```

4. **Set up Prisma database**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

## Getting API Tokens

### Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section
4. Create a bot and copy the token
5. Enable the following intents:
   - Message Content Intent
   - Server Members Intent (if needed)

### Pinterest Access Token

1. Go to [Pinterest Developers](https://developers.pinterest.com/)
2. Create a new app
3. Generate an access token with appropriate permissions
4. Copy the access token to your `.env` file

## Usage

Once the bot is running, you can use the following commands in your Discord server:

### Commands

- `!pfp <query>` - Fetches profile pictures from Pinterest
  - Example: `!pfp anime character`
  
- `!banner <query>` - Fetches banners/headers from Pinterest
  - Example: `!banner gaming`
  
- `!gif <query>` - Fetches GIFs from Pinterest
  - Example: `!gif funny cat`
  
- `!pin <pin_id>` - Fetches a specific pin by ID
  - Example: `!pin 1234567890`
  
- `!help` - Shows available commands

### Examples

```
!pfp cyberpunk
!banner landscape
!gif reaction
!pin 9876543210
```

## Project Structure

```
pinterest-discord-bot/
├── src/
│   ├── handlers/
│   │   ├── command.handler.ts    # Command processing logic
│   │   └── event.handler.ts      # Discord event handlers
│   ├── services/
│   │   ├── pinterest.service.ts  # Pinterest API integration
│   │   └── media-fetcher.service.ts # Media fetching and processing
│   └── index.ts                  # Main entry point
├── dist/                         # Compiled JavaScript (generated)
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Architecture

### Services

- **PinterestService**: Handles all interactions with the Pinterest API, including search, pin retrieval, and media parsing.

- **MediaFetcherService**: Manages downloading media from URLs, creating Discord attachments, and generating embeds.

### Handlers

- **CommandHandler**: Processes Discord commands, validates input, and executes appropriate actions.

- **EventHandler**: Registers and manages Discord bot events (ready, message create, errors, etc.).

## Development

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled bot
- `npm run dev` - Run bot with ts-node (development)
- `npm run watch` - Watch mode for TypeScript compilation
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

### Code Style

This project follows TypeScript best practices:
- Strict type checking
- ES2022 target
- Comprehensive error handling
- Async/await for asynchronous operations

## Error Handling

The bot includes comprehensive error handling:
- API request failures are caught and reported to users
- Invalid commands show helpful error messages
- Network timeouts are handled gracefully
- Media download failures don't crash the bot

## Limitations

- Maximum 5 media items per command (to prevent rate limiting)
- 25MB file size limit for downloads
- Pinterest API rate limits apply
- Discord file size limits (8MB for regular users, 25MB for Nitro)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ using Node.js, TypeScript, and Discord.js**

