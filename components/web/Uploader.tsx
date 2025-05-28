"use client";

import React, { useCallback, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "../ui/card";
import { CircularProgress } from "./UploadProgress";
import { Trash2 } from "lucide-react";
import PlaceholderImage from "@/public/placeholder.jpg";

export function Dropzone() {
  const [files, setFiles] = useState<
    Array<{
      file: File;
      uploading: boolean;
      progress: number;
      key?: string;
      isDeleting: boolean;
    }>
  >([]);

  async function removeFile(fileId: string) {
    setFiles((prevFiles) =>
      prevFiles.map((f) => (f.key === fileId ? { ...f, isDeleting: true } : f))
    );

    const response = await fetch("/api/s3/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: fileId }),
    });

    if (!response.ok) {
      toast.error("Failed to remove file from storage.");
      return;
    }

    setFiles((prevFiles) =>
      prevFiles.map((f) => (f.key === fileId ? { ...f, isDeleting: false } : f))
    );

    setFiles((prevFiles) => prevFiles.filter((f) => f.key !== fileId));

    toast.success("File removed successfully");
  }

  const uploadFile = async (file: File) => {
    setFiles((prevFiles) =>
      prevFiles.map((f) => (f.file === file ? { ...f, uploading: true } : f))
    );

    try {
      // 1. Get presigned URL
      const presignedResponse = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error("Failed to get presigned URL");
      }

      const { presignedUrl, key } = await presignedResponse.json();

      // 2. Upload file to S3

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setFiles((prevFiles) =>
              prevFiles.map((f) =>
                f.file === file
                  ? { ...f, progress: Math.round(percentComplete), key: key }
                  : f
              )
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            // 3. File fully uploaded - set progress to 100
            setFiles((prevFiles) =>
              prevFiles.map((f) =>
                f.file === file ? { ...f, progress: 100, uploading: false } : f
              )
            );

            toast.success("File uploaded successfully");

            resolve();
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Upload failed"));
        };

        xhr.open("PUT", presignedUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });
    } catch (error) {
      toast.error("Something went wrong");
      setFiles((prevFiles) =>
        prevFiles.map((f) =>
          f.file === file ? { ...f, uploading: false, progress: 0 } : f
        )
      );
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length) {
      setFiles((prevFiles) => [
        ...prevFiles,
        ...acceptedFiles.map((file) => ({
          file,
          uploading: false,
          progress: 0,
          isDeleting: false,
        })),
      ]);

      acceptedFiles.forEach(uploadFile);
    }
  }, []);

  const rejectedFiles = useCallback((fileRejection: FileRejection[]) => {
    if (fileRejection.length) {
      const toomanyFiles = fileRejection.find(
        (rejection) => rejection.errors[0].code === "too-many-files"
      );

      const fileSizetoBig = fileRejection.find(
        (rejection) => rejection.errors[0].code === "file-too-large"
      );

      if (toomanyFiles) {
        toast.error("Too many files selected, max is 5");
      }

      if (fileSizetoBig) {
        toast.error("File size exceeds 5mb limit");
      }
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: rejectedFiles,
    maxFiles: 5,
    maxSize: 1024 * 1024 * 10, // 10mb
    accept: {
      "image/*": [],
    },
  });

  return (
    <>
      <Card
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed transition-colors duration-200 ease-in-out w-full h-64",
          isDragActive
            ? "border-primary bg-primary/10 border-solid"
            : "border-border hover:border-primary"
        )}
      >
        <CardContent className="flex items-center justify-center h-full w-full">
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="text-center">Drop the files here ...</p>
          ) : (
            <div className="flex flex-col items-center gap-y-3">
              <p>Drag 'n' drop some files here, or click to select files</p>
              <Button>Select Files</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
        {files.map(({ file, uploading, progress, key, isDeleting }) => (
          <div key={file.name} className="relative w-full group">
            <div className="relative">
              <Image
                src={URL.createObjectURL(file)}
                alt={file.name}
                width={200}
                height={200}
                className={cn(
                  uploading ? "opacity-50" : "",
                  "rounded-lg object-cover size-32"
                )}
              />

              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CircularProgress progress={progress} />
                </div>
              )}
            </div>

            <Button
              className="absolute top-2 right-2"
              variant="destructive"
              size="icon"
              onClick={() => removeFile(key!)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>

            <p className="mt-2 text-sm truncate">{file.name}</p>
          </div>
        ))}
      </div>
    </>
  );
}
