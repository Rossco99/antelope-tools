import React from 'react'
import { makeStyles } from '@mui/styles'
import { List, ListItemText, ListItem } from '@mui/material'
import { useTranslation } from 'react-i18next'
import Link from '@mui/material/Link'

import { generalConfig } from '../../config'

import styles from './styles'

const useStyles = makeStyles(styles)

const Footer = () => {
  const classes = useStyles()
  const { t } = useTranslation('translations')

  return (
    <div className={classes.wrapper}>
      <div className={classes.left}>
        <List className={classes.footerMenuWrapper}>
          {generalConfig.footerLinks.map((link, index) => (
            <ListItem className={classes.listItem} key={index}>
              <ListItemText
                primary={
                  <a href={link.src} target="_blank" rel="noopener noreferrer">
                    {link.text}
                  </a>
                }
              />
            </ListItem>
          ))}
        </List>
      </div>

      <div className={classes.gridFooter}>
        <div className={classes.midText}>{t('footer1')}</div>
        <Link
          underline="none"
          href="https://eosphere.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className={classes.midFooter}>
            {t('footer2')}
            <img
              alt="EOSphere website"
              src={'/eosphere.png'}
              className={classes.imgHeaderLogo}
              loading="lazy"
            />
          </div>
        </Link>
        <Link
          underline="none"
          href="https://edenia.com/"
          target="_blank"
          rel="noopener noreferrer"
          className={classes.originalAuthors}
        >
          {t('footer3')}
        </Link>
      </div>

      <div className={classes.footerAlign}>
        <div className={classes.sidebarFooter}>
          <a
            className={classes.noUnderline}
            href={`${generalConfig.repositoryUrl}/releases`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className={classes.linkBadge}>
              {generalConfig.appVersion.split('-').pop()}
            </div>
          </a>
        </div>

        <List
          className={`${classes.footerMenuWrapper} ${classes.sidebarFooter}`}
        >
          <ListItem>
            <ListItemText
              primary={
                <Link
                  underline="none"
                  href={`${generalConfig.repositoryUrl}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('bugRequest')}
                </Link>
              }
            />
          </ListItem>
        </List>
      </div>
    </div>
  )
}

export default Footer
