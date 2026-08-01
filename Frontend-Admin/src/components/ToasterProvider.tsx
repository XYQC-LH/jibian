'use client';

import React, { useEffect, useState } from 'react';

export default function ToasterProvider() {
  const [ToasterComponent, setToasterComponent] = useState<null | React.ComponentType<{ position?: string }>>(null);

  useEffect(() => {
    let mounted = true;
    void import('react-hot-toast').then((mod) => {
      if (mounted) {
        setToasterComponent(() => mod.Toaster as React.ComponentType<{ position?: string }>);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ToasterComponent) return null;
  return <ToasterComponent position="top-right" />;
}
