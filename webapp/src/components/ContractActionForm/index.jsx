/* eslint complexity: 0 */
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { makeStyles } from '@mui/styles'
import TextField from '@mui/material/TextField'
import { useTranslation } from 'react-i18next'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'

import EOSIONewAccountAuthority from '../EOSIONewAccountAuthority'

import styles from './styles'

const useStyles = makeStyles(styles)

const ContractActionForm = ({ accountName, action, abi, onSubmitAction }) => {
  const { t } = useTranslation('contractActionFormComponent')
  const classes = useStyles()
  const [fields, setFields] = useState([])
  const [payload, setPayload] = useState({})

  const handleSubmit = () => {
    if (!onSubmitAction) return

    onSubmitAction({
      account: accountName,
      name: action,
      data: payload,
    })
  }

  const handleFieldChange = (name) => (event) => {
    const value =
      typeof event === 'object' && !Array.isArray(event)
        ? event?.target?.value
        : event

    setPayload((prevValue) => ({
      ...prevValue,
      [name]: value,
    }))
  }

  const _getFieldLabel = (label) => {
    if (!label.includes('_')) return label

    return (label.charAt(0).toUpperCase() + label.slice(1)).replace('_', ' ')
  }

  const renderField = (field, label) => {
    switch (`${accountName}.${action}.${field.name}`) {
      case 'eosio.newaccount.owner':
      case 'eosio.newaccount.active':
        return (
          <EOSIONewAccountAuthority
            key={`action-field-${field.name}`}
            label={label}
            variant="outlined"
            className={classes.formControl}
            value={payload[field.name] || ''}
            onChange={handleFieldChange(field.name)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Chip label={t('public_key')} />
                </InputAdornment>
              ),
            }}
          />
        )
      default:
        return (
          <TextField
            key={`action-field-${field.name}`}
            label={label}
            variant="outlined"
            className={classes.formControl}
            value={payload[field.name] || ''}
            onChange={handleFieldChange(field.name)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Chip label={field.type} />
                </InputAdornment>
              ),
            }}
          />
        )
    }
  }

  useEffect(() => {
    if (!action) {
      setFields([])

      return
    }

    const struct = abi?.structs?.find((struct) => struct.name === action)
    setFields(struct?.fields || [])
  }, [action, abi])

  return (
    <>
      {fields.map((field) => {
        const label = _getFieldLabel(t(field.name))

        return renderField(field, label)
      })}

      {action && (
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          {t('executeTransaction')}
        </Button>
      )}
    </>
  )
}

ContractActionForm.propTypes = {
  accountName: PropTypes.string,
  action: PropTypes.string,
  abi: PropTypes.any,
  onSubmitAction: PropTypes.func,
}

export default ContractActionForm
