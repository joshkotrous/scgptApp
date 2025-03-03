// models/RequestLog.ts - Define the Mongoose schema and model
import mongoose, { Schema, Document } from "mongoose";

// Interface for the RequestLog document
interface IRequestLog extends Document {
  ip: string;
  endpoint: string;
  timestamp: Date;
  userAgent?: string;
  query?: string;
}

// Create the schema
const RequestLogSchema: Schema = new Schema({
  ip: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  query: {
    type: String,
  },
  userAgent: {
    type: String,
  },
});
RequestLogSchema.index({ ip: 1, timestamp: 1 });
export const RequestLog =
  mongoose.models.RequestLog ||
  mongoose.model<IRequestLog>("RequestLog", RequestLogSchema);
