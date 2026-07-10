import React, { useState, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";

export default function SearchUsers({ onClose, onSelectConvo }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { searchUsers, createOrGetConversation } = useContext(AuthContext);

  const handleSearch = async (val) => {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchUsers(val);
      setResults(data || []);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user) => {
    try {
      const convo = await createOrGetConversation(user.uniqueId);
      onSelectConvo(convo);
      onClose();
    } catch (e) {
      alert("Failed to start conversation.");
      console.error(e);
    }
  };

  return (
    <div className="searchModalOverlay">
      <div className="searchModal">
        <div className="searchModalHeader">
          <h3>Search Users</h3>
          <button className="closeModalBtn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="searchInputWrapper">
          <SearchIcon className="searchBarIcon" />
          <input
            type="text"
            placeholder="Search by name, username or ID..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="searchResultsList">
          {loading ? (
            <p className="searchStatusText">Searching...</p>
          ) : results.length > 0 ? (
            results.map((user) => (
              <div
                key={user.uniqueId}
                className="searchResultItem"
                onClick={() => handleSelectUser(user)}
              >
                <div className="avatarCircle">
                  {user.profilePic ? (
                    <img src={user.profilePic} alt={user.name} className="avatarImg" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="searchResultText">
                  <div className="searchResultName">{user.name}</div>
                  <div className="searchResultId">@{user.uniqueId}</div>
                </div>
              </div>
            ))
          ) : query.trim() ? (
            <p className="searchStatusText">No users found</p>
          ) : (
            <p className="searchStatusText">Type name or unique ID to search</p>
          )}
        </div>
      </div>
    </div>
  );
}
