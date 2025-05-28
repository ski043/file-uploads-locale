import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

export const S3 = new S3Client({
  region: "auto",
  endpoint: "https://t3.storage.dev",
  forcePathStyle: false,
});
