import CloseIcon from "./CloseIcon";

const ContentViewer = ({ contentData, toggleContentMode }) => {
  if (!contentData) return null;

  return (
    <div className="content-container">
      <button 
        className="content-close-btn" 
        onClick={() => toggleContentMode(false)}
        aria-label="Close content"
      >
        <CloseIcon />
      </button>

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
          controls={contentData.controls !== false}
          autoPlay={contentData.autoPlay === true}
          className="content-video"
        />
      )}
    </div>
  );
};

export default ContentViewer;
