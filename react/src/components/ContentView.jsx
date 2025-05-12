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
          className="content-video"
          controls={false}
          autoPlay={contentData.autoPlay}
          muted={true}
          loop={true}
        />
      )}
    </div>
  );
};

export default ContentViewer;
