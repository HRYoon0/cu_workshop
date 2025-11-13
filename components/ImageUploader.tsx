'use client';

import { useState, useRef } from 'react';
import { uploadImageToDrive, getGoogleAccessToken, optimizeImage } from '@/lib/googleDrive';

interface ImageUploaderProps {
  onImageUploaded: (imageUrl: string) => void;
  currentImageUrl?: string;
}

export default function ImageUploader({ onImageUploaded, currentImageUrl }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 이미지 파일인지 확인
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 확인 (10MB 제한)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    try {
      setUploading(true);
      setError('');

      // 미리보기 표시
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // 1. 이미지 최적화 (선택사항 - 용량 절감)
      let fileToUpload = file;
      if (file.size > 1024 * 1024) { // 1MB 이상이면 최적화
        fileToUpload = await optimizeImage(file);
      }

      // 2. Google 액세스 토큰 가져오기
      const accessToken = await getGoogleAccessToken();

      // 3. Google Drive에 업로드
      const imageUrl = await uploadImageToDrive(fileToUpload, accessToken);

      // 4. 부모 컴포넌트에 URL 전달
      onImageUploaded(imageUrl);
      setPreview(imageUrl);
    } catch (err: any) {
      console.error('이미지 업로드 실패:', err);
      setError(err.message || '이미지 업로드에 실패했습니다.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onImageUploaded('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        이미지 추가 (선택사항)
      </label>

      {preview ? (
        // 이미지 미리보기
        <div className="relative">
          <img
            src={preview}
            alt="업로드된 이미지"
            className="w-full max-h-64 object-contain rounded-lg border border-gray-300"
          />
          <button
            type="button"
            onClick={handleRemoveImage}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
            title="이미지 삭제"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        // 업로드 버튼
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="image-upload"
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors ${
              uploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <>
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
                  <p className="text-sm text-gray-500">업로드 중...</p>
                </>
              ) : (
                <>
                  <svg
                    className="w-10 h-10 mb-3 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">클릭하여 이미지 업로드</span>
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF (최대 10MB)</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="image-upload"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-500">
        이미지는 자동으로 Google Drive에 업로드됩니다.
      </p>
    </div>
  );
}
