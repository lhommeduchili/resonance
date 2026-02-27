"use client";

import { useEffect, useRef } from "react";

interface AudioWaveformProps {
    stream: MediaStream | null;
}

export function AudioWaveform({ stream }: AudioWaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationIdRef = useRef<number>(0);

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Initialize Audio Context if absent
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const audioCtx = audioCtxRef.current;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser); // We do not connect to destination (speakers) to avoid feedback

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // Rendering Loop
        const draw = () => {
            animationIdRef.current = requestAnimationFrame(draw);

            analyser.getByteTimeDomainData(dataArray);

            // Clear background (with slight transparency for a trailing effect, optional)
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#707070"; // highlight color from CSS array
            ctx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };

        draw();

        return () => {
            cancelAnimationFrame(animationIdRef.current);
            source.disconnect();
        };
    }, [stream]);

    if (!stream) {
        return (
            <div className="w-full h-12 flex items-center justify-center border border-accent/50 bg-black/40 text-xs text-accent uppercase tracking-widest">
                [ Waiting for Signal ]
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={400}
            height={48}
            className="w-full h-12 border border-highlight/50 bg-black/60"
        />
    );
}
