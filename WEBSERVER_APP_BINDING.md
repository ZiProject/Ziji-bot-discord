# Webserver App Binding

## Tổng quan

Webserver đã được bind với App class system để có thể truy cập đầy đủ vào context của ứng dụng Discord bot.

## Các thay đổi đã thực hiện

### 1. Bind App Context

- Webserver function `startServer()` giờ đây nhận app context thông qua `this` binding
- Sử dụng `appContext` để truy cập các services như client, manager, logger, config

### 2. API Endpoints mới

#### `/api/app` - Thông tin App Context

```json
{
  "status": "OK",
  "appStatus": {
    "client": true,
    "clientReady": true,
    "commands": 45,
    "functions": 12,
    "cooldowns": 0,
    "responder": 3,
    "welcome": 2,
    "giveaways": true,
    "manager": true,
    "config": true,
    "logger": true
  },
  "config": {...},
  "commandsCount": 45,
  "functionsCount": 12,
  "cooldownsCount": 0,
  "responderCount": 3,
  "welcomeCount": 2
}
```

#### `/` - Endpoint chính với App Status

Endpoint chính giờ đây bao gồm thông tin `appStatus` trong response.

### 3. WebSocket Events mới

#### `GetAppInfo` Event

Client có thể gửi event này để lấy thông tin app context:

```javascript
ws.send(
	JSON.stringify({
		event: "GetAppInfo",
	}),
);
```

Response:

```json
{
  "event": "AppInfo",
  "appStatus": {...},
  "commandsCount": 45,
  "functionsCount": 12
}
```

#### Statistics với App Info

Event `statistics` giờ đây bao gồm thông tin app:

```json
{
  "event": "statistics",
  "timestamp": 12345,
  "listeners": 5,
  "tracks": 10,
  "volume": 50,
  "paused": false,
  "repeatMode": "off",
  "track": {...},
  "queue": [...],
  "filters": null,
  "shuffle": null,
  "appInfo": {
    "commandsCount": 45,
    "functionsCount": 12,
    "clientReady": true
  }
}
```

## Cách sử dụng

### 1. Khởi động Bot

```bash
node index.js
```

### 2. Test Webserver

```bash
node test-webserver.js
```

### 3. Truy cập API

- Main endpoint: `http://localhost:2003/`
- App info: `http://localhost:2003/api/app`
- Search: `http://localhost:2003/api/search?query=your_search`
- Lyrics: `http://localhost:2003/api/lyrics?query=song_name`

## Lợi ích

1. **Truy cập đầy đủ App Context**: Webserver có thể truy cập tất cả services và collections
2. **Monitoring**: Có thể monitor trạng thái của bot qua API
3. **Integration**: Dễ dàng tích hợp với frontend applications
4. **Real-time Updates**: WebSocket cung cấp thông tin real-time về app status

## Cấu trúc Binding

```javascript
// Trong index.js
startServer.bind(app).catch((error) => logger.error("Error start Server:", error));

// Trong web/index.js
async function startServer() {
	const appContext = this; // App instance được bind
	const logger = appContext.logger;
	const client = appContext.client;
	const manager = appContext.manager;
	// ... sử dụng app context
}
```

## Lưu ý

- Webserver sẽ tự động khởi động khi bot start
- Port mặc định: 2003 (có thể thay đổi qua `SERVER_PORT` env variable)
- Ngrok integration sẵn có nếu có `NGROK_AUTHTOKEN`
- Tất cả endpoints đều có error handling
