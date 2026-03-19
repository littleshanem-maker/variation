'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FieldHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/capture');
  }, []);

  // Render nothing — instant redirect, no flash
  return null;
}
