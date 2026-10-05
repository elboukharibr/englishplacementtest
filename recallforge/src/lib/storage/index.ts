// Storage abstraction. Local disk for development; any S3-compatible service
// (AWS S3, Cloudflare R2, Supabase Storage S3 endpoint) in production.
import { promises as fs } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements StorageDriver {
  private root = path.resolve(process.cwd(), env.localStorageDir);
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }
  async get(key: string) {
    return fs.readFile(this.resolve(key));
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}

class S3Storage implements StorageDriver {
  private client: S3Client;
  private bucket: string;
  constructor() {
    if (!env.s3.bucket || !env.s3.accessKeyId || !env.s3.secretAccessKey) {
      throw new Error("S3 storage selected but S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are missing.");
    }
    this.bucket = env.s3.bucket;
    this.client = new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint,
      forcePathStyle: Boolean(env.s3.endpoint),
      credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
    });
  }
  async put(key: string, data: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType, ServerSideEncryption: env.s3.endpoint ? undefined : "AES256" }),
    );
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!driver) driver = env.storageDriver === "s3" ? new S3Storage() : new LocalStorage();
  return driver;
}

export function storageKeyFor(userId: string, documentId: string, ext: string) {
  return `users/${userId}/documents/${documentId}/original.${ext}`;
}
