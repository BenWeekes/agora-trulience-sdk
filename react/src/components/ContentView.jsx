// ContentView.jsx
const ContentViewer = ({ contentData, toggleContentMode }) => {
  if (!contentData) return null;

  return (
    <div className="content-container">
      {contentData.type === "image" && (
        <img 
          src={contentData.url} 
          alt={contentData.alt || "Content"} 
          className="content-image"
        />
      )}

      {contentData.type === "video" && (
        <video 
          src={contentData.url} 
          controls={false} // {contentData.controls !== false}
          autoPlay={true} // Always auto-play when displayed
          muted={true} // Mute by default
          loop={true} // Mute by default
          className="content-video"
        />
      )}

    </div>
  );
};

export default ContentViewer;