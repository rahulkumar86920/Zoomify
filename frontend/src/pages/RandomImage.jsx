import React, { useEffect, useState } from "react";

const RandomImage = () => {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const fetchImage = async () => {
      const accessKey = "b9-Rw3J0xC0Ra9fCyr0JFPkz7gvgDR_PsKdcl0T75ME"; // Replace with your Unsplash access key

      try {
        const res = await fetch(
          `https://api.unsplash.com/photos/random?query=technology&client_id=${accessKey}`
        );
        const data = await res.json();
        setImageUrl(data.urls.regular);
      } catch (err) {
        console.error("Error fetching Unsplash image:", err);
      }
    };

    fetchImage();
  }, []);

  return (
    <div
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
      }}
    >
     
    </div>
  );
};

export default RandomImage;
