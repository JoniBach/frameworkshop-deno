# Frameworkshop Deno API

Base URL: `http://localhost:3000`

All request bodies must use `Content-Type: application/json`.

## CORS

The API allows cross-origin requests from the frontend workshop apps.

Allowed methods:

- `POST`
- `GET`
- `DELETE`
- `OPTIONS`

Allowed headers:

- `content-type`

## Shared response shapes

### Safe user

```json
{
  "id": "string",
  "email": "user@example.com",
  "createdAt": "2026-06-01T11:00:00.000Z"
}
```

Password and password hash values are never returned.

### Error

```json
{
  "error": "message"
}
```

## `POST /auth/register`

Creates a new user.

### Request

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Validation

- `email` must be a valid email address.
- `password` must be at least 9 characters.
- Duplicate users are rejected.

### Success response

Status: `201 Created`

```json
{
  "status": "ok",
  "user": {
    "id": "string",
    "email": "user@example.com",
    "createdAt": "2026-06-01T11:00:00.000Z"
  }
}
```

### Error responses

- `400 Bad Request` for invalid email, weak password, invalid JSON, or non-object JSON.
- `409 Conflict` when the user already exists.
- `415 Unsupported Media Type` when the request is not JSON.

## `POST /auth/login`

Authenticates an existing user.

### Request

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Validation

- `email` and `password` are required.
- Invalid credentials return the same error for unknown users and wrong passwords.

### Success response

Status: `200 OK`

```json
{
  "status": "ok",
  "user": {
    "id": "string",
    "email": "user@example.com",
    "createdAt": "2026-06-01T11:00:00.000Z"
  }
}
```

### Error responses

- `400 Bad Request` for missing email/password, invalid JSON, or non-object JSON.
- `401 Unauthorized` for invalid email or password.
- `415 Unsupported Media Type` when the request is not JSON.

## `DELETE /auth/user`

Deletes an existing user by email.

### Request

```json
{
  "email": "user@example.com"
}
```

### Validation

- `email` must be a valid email address.
- The user must exist.

### Success response

Status: `200 OK`

```json
{
  "status": "ok",
  "deleted": {
    "email": "user@example.com"
  }
}
```

### Error responses

- `400 Bad Request` for invalid email, invalid JSON, or non-object JSON.
- `404 Not Found` when the user does not exist.
- `415 Unsupported Media Type` when the request is not JSON.

## `GET /input-example`

Returns the current saved input-example entry.

### Empty response

Status: `200 OK`

```json
{
  "status": "empty",
  "data": null
}
```

### Success response

Status: `200 OK`

```json
{
  "status": "ok",
  "data": {
    "id": "string",
    "timestamp": "2026-06-01T11:00:00.000Z",
    "input": {}
  }
}
```

## `POST /input-example`

Stores the current input-example entry.

### Request

The request body must contain an `email` property.

```json
{
  "email": "user@example.com"
}
```

### Success response

Status: `200 OK`

```json
{
  "status": "ok",
  "saved": {
    "id": "string",
    "timestamp": "2026-06-01T11:00:00.000Z",
    "input": {
      "email": "user@example.com"
    }
  }
}
```

### Error responses

- `400 Bad Request` for missing email or invalid JSON.
- `415 Unsupported Media Type` when the request is not JSON.
