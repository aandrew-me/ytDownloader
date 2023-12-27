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
}

export {
    format,
    info
}