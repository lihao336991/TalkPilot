import {
  completeHandler,
  createDownloadTask,
  directories,
  setConfig,
} from '@kesha-antonov/react-native-background-downloader';
import type {
  Config,
  DownloadOption,
  DownloadTask,
  ErrorHandlerParams,
} from '@kesha-antonov/react-native-background-downloader';

export type BackgroundDownloadProgress = {
  bytesDownloaded: number;
  bytesTotal: number;
  progress: number;
};

export type BackgroundDownloadRequest = DownloadOption & {
  onBegin?: (expectedBytes: number) => void;
  onProgress?: (event: BackgroundDownloadProgress) => void;
};

export type BackgroundDownloadResult = {
  location: string;
  bytesDownloaded: number;
  bytesTotal: number;
};

class BackgroundDownloadService {
  readonly documentsDirectory = directories.documents;

  configure(config: Partial<Config>) {
    setConfig(config);
  }

  createTask(request: BackgroundDownloadRequest): DownloadTask {
    const task = createDownloadTask(request);

    if (request.onBegin) {
      task.begin(({ expectedBytes }) => {
        request.onBegin?.(expectedBytes);
      });
    }

    if (request.onProgress) {
      task.progress(({ bytesDownloaded, bytesTotal }) => {
        request.onProgress?.({
          bytesDownloaded,
          bytesTotal,
          progress: bytesTotal > 0 ? bytesDownloaded / bytesTotal : 0,
        });
      });
    }

    return task;
  }

  downloadFile(request: BackgroundDownloadRequest) {
    return new Promise<BackgroundDownloadResult>((resolve, reject) => {
      const task = this.createTask(request);

      task
        .done(({ location, bytesDownloaded, bytesTotal }) => {
          completeHandler(request.id);
          resolve({ location, bytesDownloaded, bytesTotal });
        })
        .error((event: ErrorHandlerParams) => {
          reject(
            new Error(
              event.error || `后台下载失败，错误码 ${event.errorCode ?? 'unknown'}`
            )
          );
        })
        .start();
    });
  }
}

export default new BackgroundDownloadService();
