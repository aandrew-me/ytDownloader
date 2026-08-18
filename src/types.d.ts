import type YTDlpWrapClass from "yt-dlp-wrap-plus";
import type { ChildProcess, SpawnSyncReturns, ExecException } from "child_process";
import type { Stats } from "fs";

type format = {
    vcodec?: string,
    acodec?: string,
    ext: string,
    filesize?: number,
    format_id: string,
    format_note: string,
    height: number,
    resolution: string,
    video_ext: string,
    audio_ext: string,
    filesize_approx?: number,
    tbr: number,
    fps: number,
}

type info = {
    title: string,
    id: string,
    thumbnail: string,
    duration: number,
    formats: format[],
    extractor_key: string,
}

/** Derived from the library — stays in sync automatically on updates */
type YTDlpWrapInstance = InstanceType<typeof YTDlpWrapClass>;

/** Plain object exposed via contextBridge as window.electronAPI.YTDlpWrap */
interface YTDlpWrapBridge {
    new(binaryPath: string): YTDlpWrapInstance;
    downloadFromGithub: typeof YTDlpWrapClass.downloadFromGithub;
}

interface SpawnChildWrapper {
    stdout: { on(event: string, cb: (data: string) => void): void };
    stderr: { on(event: string, cb: (data: string) => void): void };
    ytDlpProcess: {
        spawnargs: string[];
        kill(signal?: string): void;
        readonly killed: boolean;
        readonly pid: number | undefined;
        stdout: { on(event: string, cb: (data: string) => void): void } | null;
        stderr: { on(event: string, cb: (data: string) => void): void } | null;
    };
    kill(signal?: string): void;
    readonly killed: boolean;
    on(event: string, cb: (...args: any[]) => void): void;
    once(event: string, cb: (...args: any[]) => void): void;
}

interface FsPromises {
    readFile(path: string, options?: { encoding?: BufferEncoding }): Promise<string | Buffer>;
    writeFile(path: string, data: any, options?: { encoding?: BufferEncoding }): Promise<void>;
    access(path: string, mode?: number): Promise<void>;
    unlink(path: string): Promise<void>;
    stat(path: string): Promise<Stats>;
    lstat(path: string): Promise<Stats>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
    readdir(path: string, options?: any): Promise<string[]>;
}

interface ElectronAPI {
    shell: {
        openExternal(url: string): Promise<void>;
        openPath(path: string): Promise<string>;
        showItemInFolder(path: string): void;
    };
    ipcRenderer: {
        send(channel: string, ...args: any[]): void;
        on(channel: string, listener: (event: any, ...args: any[]) => void): void;
        once(channel: string, listener: (event: any, ...args: any[]) => void): void;
        removeListener(channel: string, listener: (...args: any[]) => void): void;
    };
    clipboard: {
        readText(): string;
        writeText(text: string): void;
    };
    YTDlpWrap: YTDlpWrapBridge;
    homedir: () => string;
    platform: () => string;
    tmpdir: () => string;
    join(...paths: string[]): string;
    mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
    accessSync(path: string, mode?: number): void;
    promises: FsPromises;
    existsSync(path: string): boolean;
    cpSync(src: string, dest: string, options?: any): void;
    copyFileSync(src: string, dest: string, flags?: number): void;
    writeFileSync(path: string, data: any, options?: any): void;
    unlinkSync(path: string): void;
    readFileSync(path: string, options?: any): string | Buffer;
    readdirSync(path: string, options?: any): string[];
    statSync(path: string): Stats;
    lstatSync(path: string): Stats;
    execSync(command: string, options?: any): Buffer | string;
    spawn(command: string, args?: string[], options?: any): SpawnChildWrapper;
    spawnSync(command: string, args?: string[], options?: any): SpawnSyncReturns<Buffer>;
    exec(command: string, options: any, callback: (err: ExecException | null, stdout: string, stderr: string) => void): ChildProcess;
    env: Record<string, string | undefined>;
    getEnv(key: string): string | undefined;
    setEnv(key: string, value: string): void;
    constants: { W_OK: number; F_OK: number; R_OK: number; X_OK: number };
    isTest: boolean;
    windowsStore: boolean;
    __dirname: string;
    si: { graphics(): Promise<any> };
    crypto: {
        randomUUID(): string;
        randomBytes(size: number): Buffer;
    };
    rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
        __mockYtDlp?: YTDlpWrapInstance;
        __mockSpawn?: any;
        __mockFfmpeg?: any;
        __executedCommands?: any[];
        __mockMetadata?: any;
        i18n?: {
            __(key: string): string;
            setLocale(locale: string): void;
            getLocale(): string;
        };
        switchView?: (targetViewId: string) => void;
        toggleSidebar?: (collapse?: boolean) => void;
        loadHistory?: () => void;
        initCompressorGPU?: () => void;
        playlistDownloader?: any;
        selectVideo?: () => void;
        selectAudio?: () => void;
        advancedToggle?: () => void;
        toggleErrorDetails?: () => void;
        AppBinaries?: {
            ffmpegPath?: string;
            jsRuntimePath?: string;
            [key: string]: any;
        };
        SlimSelect?: any;
    }
}

export { format, info, ElectronAPI, FsPromises, SpawnChildWrapper, YTDlpWrapBridge };
