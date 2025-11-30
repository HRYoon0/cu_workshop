'use client';

import { useState, useRef, useEffect } from 'react';
import { uploadImageToDrive, getGoogleAccessToken, optimizeImage } from '@/lib/googleDrive';

interface ImageUploaderProps {
  onImageUploaded?: (imageUrl: string) => void;
  onUploadSuccess?: (imageUrl: string) => void; // 별칭 지원
  currentImageUrl?: string;
  uploaderId?: string;
  folderName?: string; // 구글 드라이브 내 서브폴더명 (기본값: '이미지')
  folder?: string; // folderName의 별칭
  userId?: string; // 사용자 ID (학교 이름 폴더 구분용)
}

export default function ImageUploader({
  onImageUploaded,
  onUploadSuccess,
  currentImageUrl,
  uploaderId = 'image-upload',
  folderName,
  folder,
  userId
}: ImageUploaderProps) {
  // 콜백 함수 통합
  const handleUpload = onUploadSuccess || onImageUploaded || (() => {});
  // 폴더 이름 통합
  const targetFolder = folder || folderName || '이미지';
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 로그인 시 저장된 토큰 불러오기
  useEffect(() => {
    const savedToken = localStorage.getItem('googleAccessToken');
    if (savedToken) {
      setAccessToken(savedToken);
    }
  }, []);

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

      // 0. userId 확인
      if (!userId) {
        throw new Error('사용자 ID가 필요합니다. 로그인 상태를 확인해주세요.');
      }

      // 1. 즉시 로컬 미리보기 표시
      const reader = new FileReader();
      reader.onload = (e) => {
        const localUrl = e.target?.result as string;
        handleUpload(localUrl); // 로컬 미리보기 먼저 표시
      };
      reader.readAsDataURL(file);

      // 2. 이미지 최적화
      let fileToUpload = file;
      if (file.size > 1024 * 1024) {
        fileToUpload = await optimizeImage(file);
      }

      // 3. 액세스 토큰 확인
      let token = accessToken;
      if (!token) {
        token = await getGoogleAccessToken();
        setAccessToken(token);
        localStorage.setItem('googleAccessToken', token);
      }

      // 4. Google Drive에 업로드
      let imageUrl: string;
      try {
        imageUrl = await uploadImageToDrive(fileToUpload, token, targetFolder, userId);
      } catch (uploadError: any) {
        // 토큰 만료 시 재요청
        if (uploadError.message?.includes('401') || uploadError.message?.includes('unauthorized')) {
          token = await getGoogleAccessToken();
          setAccessToken(token);
          localStorage.setItem('googleAccessToken', token);
          imageUrl = await uploadImageToDrive(fileToUpload, token, targetFolder, userId);
        } else {
          throw uploadError;
        }
      }

      // 5. Google Drive URL로 업데이트
      handleUpload(imageUrl);
    } catch (err: any) {
      console.error('이미지 업로드 실패:', err);
      setError(err.message || '이미지 업로드에 실패했습니다.');
      handleUpload('');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    handleUpload('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setError('');
      const token = await getGoogleAccessToken();
      setAccessToken(token);
      localStorage.setItem('googleAccessToken', token);
      alert('Google Drive에 성공적으로 연결되었습니다!');
    } catch (err: any) {
      console.error('Google Drive 연결 실패:', err);
      setError(err.message || 'Google Drive 연결에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        이미지 추가 (선택사항)
      </label>

      {currentImageUrl ? (
        // 이미지 미리보기
        <div className="relative">
          <img
            src={currentImageUrl}
            alt="업로드된 이미지"
            className="w-full max-h-64 object-contain rounded-lg border border-gray-300"
            onError={(e) => {
              // 이미지 로드 실패 시 처리
              console.error('이미지 로드 실패:', currentImageUrl);
            }}
          />
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-white border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-white text-sm font-semibold">Google Drive에 업로드 중...</p>
              </div>
            </div>
          )}
          {!uploading && (
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
          )}
        </div>
      ) : (
        // 업로드 버튼
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor={uploaderId}
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
              id={uploaderId}
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

      {!currentImageUrl && !uploading && (
        <p className="text-xs text-gray-500">
          이미지는 자동으로 Google Drive에 업로드됩니다.
        </p>
      )}
    </div>
  );
}
