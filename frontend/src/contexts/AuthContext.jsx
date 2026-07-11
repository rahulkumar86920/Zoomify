import axios from "axios";
import httpStatus from "http-status";
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";

export const AuthContext = createContext({});

/* const client = axios.create({
  baseURL: `${server}/api/v1/users`,
}); */
const accessKey = "b9-Rw3J0xC0Ra9fCyr0JFPkz7gvgDR_PsKdcl0T75ME"; // Replace with your Unsplash access key

const client = axios.create({
  baseURL: `${server}/api/v1/users`, // now fixed
});

export const AuthProvider = ({ children }) => {
  const authContext = useContext(AuthContext);

  const [userData, setUserData] = useState(authContext);

  const router = useNavigate();

  const handleRegister = async (name, username, password, profilePic) => {
    try {
      let request = await client.post("/register", {
        name: name,
        username: username,
        password: password,
        profilePic: profilePic,
      });

      if (request.status === httpStatus.CREATED) {
        return request.data.message;
      }
    } catch (err) {
      throw err;
    }
  };

  const handleLogin = async (username, password) => {
    try {
      let request = await client.post("/login", {
        username: username,
        password: password,
      });

      console.log(username, password);
      console.log(request.data);

      if (request.status === httpStatus.OK) {
        localStorage.setItem("token", request.data.token);
        if (request.data.name) localStorage.setItem("name", request.data.name);
        if (request.data.username) localStorage.setItem("username", request.data.username);
        if (request.data.uniqueId) localStorage.setItem("uniqueId", request.data.uniqueId);
        localStorage.setItem("profilePic", request.data.profilePic || "");
        router("/home");
      }
    } catch (err) {
      throw err;
    }
  };

  const updateProfile = async (name, uniqueId, profilePic) => {
    try {
      let request = await client.put("/profile", {
        name,
        uniqueId,
        profilePic,
      }, {
        headers: { token: localStorage.getItem("token") },
      });
      if (request.status === httpStatus.OK) {
        if (request.data.name) localStorage.setItem("name", request.data.name);
        if (request.data.uniqueId) localStorage.setItem("uniqueId", request.data.uniqueId);
        localStorage.setItem("profilePic", request.data.profilePic || "");
      }
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const searchUsers = async (query) => {
    try {
      let request = await client.get("/search", {
        params: { q: query },
        headers: { token: localStorage.getItem("token") },
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const getConversations = async () => {
    try {
      let request = await axios.get(`${server}/api/v1/chat/conversations`, {
        headers: { token: localStorage.getItem("token") },
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const getMessages = async (conversationId) => {
    try {
      let request = await axios.get(`${server}/api/v1/chat/messages/${conversationId}`, {
        headers: { token: localStorage.getItem("token") },
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const createOrGetConversation = async (recipientUniqueId) => {
    try {
      let request = await axios.post(`${server}/api/v1/chat/conversations`, {
        recipientUniqueId,
      }, {
        headers: { token: localStorage.getItem("token") },
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const getHistoryOfUser = async () => {
    try {
      let request = await client.get("/get_all_activity", {
        params: {
          token: localStorage.getItem("token"),
        },
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const addToUserHistory = async (meetingCode) => {
    try {
      let request = await client.post("/add_to_activity", {
        token: localStorage.getItem("token"),
        meeting_code: meetingCode,
      });
      return request;
    } catch (e) {
      throw e;
    }
  };

  const data = {
    userData,
    setUserData,
    addToUserHistory,
    getHistoryOfUser,
    handleRegister,
    handleLogin,
    searchUsers,
    getConversations,
    getMessages,
    createOrGetConversation,
    updateProfile,
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};
