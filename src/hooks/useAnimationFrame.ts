"use client";

import { useEffect, useRef } from 'react';

export const useAnimationFrame = (callback: (deltaTime: number) => void) => {
    const requestRef = useRef<number>(0);
    const previousTimeRef = useRef<number>(0);
    const callbackRef = useRef(callback);

    // Keep callback ref updated with the latest render closure
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const animate = (time: number) => {
        if (previousTimeRef.current != undefined) {
            const deltaTime = time - previousTimeRef.current;
            callbackRef.current(deltaTime);
        }
        previousTimeRef.current = time;
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, []); // Empty array ensures this only mounts once
};
