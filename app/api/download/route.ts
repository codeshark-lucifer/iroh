import { NextRequest, NextResponse } from 'next/server';
import YouTubeDownloader from '@/lib/downloader';
import { Readable } from 'stream';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
        return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    try {
        const downloader = new YouTubeDownloader();
        // Force video mode
        const { stream, mimeType } = await downloader.getDownloadStream(videoId, 'video');

        const headers = new Headers();
        let extension = 'mp4';
        if (mimeType && mimeType.includes('webm')) extension = 'webm';
        
        headers.set('Content-Disposition', `attachment; filename="video_${videoId}.${extension}"`);
        if (mimeType) headers.set('Content-Type', mimeType);

        // Convert Node.js Readable stream to Web ReadableStream
        // @ts-ignore
        const webStream = Readable.toWeb(stream);

        return new Response(webStream as ReadableStream, { headers });
    } catch (error: any) {
        console.error('Download error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
