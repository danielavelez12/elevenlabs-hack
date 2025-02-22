import { PhoneCall, Settings } from "lucide-react";
import type React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

const StyledNavbarLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s ease-in-out;
  color: white;
  &:hover {
    background-color: #202533;
  }
`;

const NavbarContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 100px;
  gap: 0.5rem;
  border-right: 1px solid #202533;
`;

const Navbar: React.FC = () => {
  return (
    <NavbarContainer>
      <div className="p-6">
        <div className="space-y-2">
          <StyledNavbarLink to="/voice-setup">
            <Settings className="h-5 w-5" />
          </StyledNavbarLink>
          <StyledNavbarLink to="/make-call">
            <PhoneCall className="h-5 w-5" />
          </StyledNavbarLink>
        </div>
      </div>
    </NavbarContainer>
  );
};

export default Navbar;
