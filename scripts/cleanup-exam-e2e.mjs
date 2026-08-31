import nextEnv from "@next/env";
import { MongoClient } from "mongodb";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db("Polaris");
  const users = await db.collection("users")
    .find({ email: /^exam-e2e-\d+@polaris\.test$/ }, { projection: { _id: 1, email: 1 } })
    .toArray();
  const userIds = users.map((user) => user._id.toHexString());
  const sessions = await db.collection("exam_sessions")
    .find({ userId: { $in: userIds } }, { projection: { _id: 1, formId: 1, resultId: 1 } })
    .toArray();
  const sessionIds = sessions.map((session) => session._id);
  const formIds = sessions.map((session) => session.formId).filter(Boolean);
  const recordingFiles = await db.collection("exam_speaking_audio.files")
    .find({ "metadata.userId": { $in: userIds } }, { projection: { _id: 1 } })
    .toArray();
  const recordingIds = recordingFiles.map((file) => file._id);

  await Promise.all([
    db.collection("exam_speaking_audio.chunks").deleteMany({ files_id: { $in: recordingIds } }),
    db.collection("exam_speaking_audio.files").deleteMany({ _id: { $in: recordingIds } }),
    db.collection("exam_responses").deleteMany({ userId: { $in: userIds } }),
    db.collection("exam_results").deleteMany({ userId: { $in: userIds } }),
    db.collection("exam_ai_generations").deleteMany({ userId: { $in: userIds } }),
    db.collection("exam_practice_attempts").deleteMany({ userId: { $in: userIds } }),
    db.collection("exam_writing_practices").deleteMany({ userId: { $in: userIds } }),
    db.collection("exam_session_events").deleteMany({ sessionId: { $in: sessionIds } }),
    db.collection("exam_exposures").deleteMany({ userId: { $in: userIds } }),
    db.collection("exam_forms").deleteMany({ _id: { $in: formIds } }),
    db.collection("exam_sessions").deleteMany({ _id: { $in: sessionIds } }),
    db.collection("users").deleteMany({ _id: { $in: users.map((user) => user._id) } }),
  ]);
  console.log(JSON.stringify({ removedUsers: users.length, removedSessions: sessions.length, removedRecordings: recordingIds.length }));
} finally {
  await client.close();
}
