# Discord Bot Setup

## 1. Create a Discord Application

- Go to the [Discord Developer Portal](https://discord.com/developers/applications)
- Click **New Application**
- Give your application a name (e.g., `ClaudeCode`)
- Click **Create**

<img width="500" height="500" alt="app-create" src="https://github.com/user-attachments/assets/ee8bdf4e-9bbf-4d01-8046-a182ca6d5da9" />

## 2. Copy Application ID

- Go to **General Information** and copy the **Application ID**

<img width="800" height="500" alt="APPLICATION_ID" src="https://github.com/user-attachments/assets/3ad02111-0a9f-4f0f-8a77-d61841f6dd27" />

## 3. Create a Bot User

- Go to the **Bot** section in the left sidebar
- Click **Add Bot**
- Under **Token**, click **Copy** (keep this secure!)
- Click **Save Changes**

<img width="800" height="500" alt="bot-token" src="https://github.com/user-attachments/assets/0621b5ed-c4b4-44e3-a3f6-fe678f6893c3" />

## 4. Invite the Bot to Your Server

Go to **OAuth2 > URL Generator** and select these scopes:

```
bot
applications.commands
```

Then select **all** of the following bot permissions:

| Permission | Why It's Needed |
|---|---|
| **Manage Channels** | Creates categories and text channels on startup (one per branch) |
| **View Channels** | Finds existing categories/channels to avoid duplicates |
| **Send Messages** | Sends embeds, streaming output, completion messages, startup notification |
| **Embed Links** | All bot output uses rich embeds (code, status, completions, errors) |
| **Attach Files** | File attachment support in message payloads |
| **Read Message History** | Reads channel to find its own messages |
| **Use External Emojis** | Emoji formatting in status and completion embeds |
| **Use Application Commands** | All 45+ slash commands |

**Quick invite URL** (replace `YOUR_APP_ID`):

```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot+applications.commands&permissions=412317248576
```

**Gateway Intents:** Only the **Guilds** intent is used. No privileged intents (Message Content, Members, Presence) required. No toggles needed in the Developer Portal.

Copy the generated URL, open it in your browser, select your Discord server, and authorize the bot.

<img width="800" height="500" alt="oauth2" src="https://github.com/user-attachments/assets/3e1fe004-1ae5-4078-b1a4-882a11bc68cd" />
<img width="800" height="500" alt="botallowcommands" src="https://github.com/user-attachments/assets/9cd92467-2f3d-4c03-abb0-9f10ec979a1b" />
<img width="800" height="500" alt="authorize" src="https://github.com/user-attachments/assets/697f6f52-fe37-4885-b492-5d660f23596d" />

## Next Steps

Once your bot is set up, follow the [Installation Guide](installation.md) to run it.
