# Geog Stamp Quest v2

Multi-teacher version. v1 (root) stays unchanged.

## Flow
1. `v2/index.html` — Gmail login
2. `v2/dashboard.html` — teacher dashboard (create / edit / delete programs, copy play URL)
3. `v2/admin.html?p={programId}` — program admin (locations, quizzes, intro media)
4. `v2/play.html?p={programId}` — public play URL for students

## Firestore
```
users/{uid}           { email, displayName, createdAt }
programs/{programId}  { name, subject, ownerUid, ownerEmail, createdAt, settings }
programs/{programId}/locations/{locId}  { order, name, lat, lng, quizzes, introMedia, ... }
```

## Firebase setup needed
1. Authentication → Google enabled (same project)
2. Firestore rules: owner can write own programs; public read locations for play
3. Authorized domains include github.io
