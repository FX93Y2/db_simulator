import React from 'react';
import { NavLink } from 'react-router-dom';
import { Container, Navbar } from 'react-bootstrap';
import { FiSun, FiMoon } from 'react-icons/fi';
import appIcon from '../../../public/icon.png';

import styles from './Header.module.css';

const Header = ({ currentTheme, onToggleTheme }) => {
  return (
    <Navbar expand="lg" className={styles.appHeader}>
      <Container fluid>
        <Navbar.Brand as={NavLink} to="/" className={styles.appIconBrand}>
          <img
            src={appIcon}
            alt="App Icon"
            className={styles.appIcon}
          />
        </Navbar.Brand>
        
        <div className="ms-auto">
          <div
            className={styles.themeToggleSwitch}
            onClick={onToggleTheme}
            title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className={styles.themeIcons}>
              <FiSun className={`${styles.themeIcon} ${styles.sun}`} />
              <FiMoon className={`${styles.themeIcon} ${styles.moon}`} />
            </div>
            <div className={`${styles.themeToggleSlider} ${currentTheme === 'dark' ? styles.active : ''}`}></div>
          </div>
        </div>
      </Container>
    </Navbar>
  );
};

export default Header; 