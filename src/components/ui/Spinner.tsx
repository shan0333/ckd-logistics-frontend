export default function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  if (fullScreen) {
    // z-[60] — deliberately above Modal's z-50, so a blocking loader always sits on top of
    // (and physically intercepts clicks/Escape meant for) any open modal, not just the caller's.
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="flex justify-center py-8">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
